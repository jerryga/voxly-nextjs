/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteFromS3, uploadToS3 } from "@/lib/storage/s3";
import { inngest } from "@/inngest/client";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { ensureCreditsAvailableForExpectedProcessing } from "@/lib/billing";
import { enforceRateLimit, enforceSameOrigin } from "@/lib/api/security";
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
} from "@/lib/api/validation";
import { buildTranscriptionSearchText } from "@/lib/transcriptions/searchText";
import { resolveTemplateSelectionForUser } from "@/lib/templates";
import { requireWorkspaceContext } from "@/lib/workspaces";

export const runtime = "nodejs";

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function shouldProcessInline(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return (
    (message.includes("Branch environment name is required") ||
      message.includes("Branch environment does not exist"))
  );
}

function isLocalDevelopment() {
  return process.env.NODE_ENV !== "production";
}

function getInngestDebugSnapshot() {
  const eventKey = process.env.INNGEST_EVENT_KEY || "";

  return {
    nodeEnv: process.env.NODE_ENV || null,
    inngestClientEnv: inngest.env,
    eventKeyPresent: Boolean(eventKey),
    eventKeyPrefix: eventKey ? eventKey.slice(0, 12) : null,
    hostBranchVars: {
      INNGEST_ENV: process.env.INNGEST_ENV || null,
      BRANCH_NAME: process.env.BRANCH_NAME || null,
      BRANCH: process.env.BRANCH || null,
      VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF || null,
      CF_PAGES_BRANCH: process.env.CF_PAGES_BRANCH || null,
      RENDER_GIT_BRANCH: process.env.RENDER_GIT_BRANCH || null,
      RAILWAY_GIT_BRANCH: process.env.RAILWAY_GIT_BRANCH || null,
    },
  };
}

export async function POST(request: Request) {
  let transcriptionId: string | null = null;
  let uploadedKey: string | null = null;

  try {
    const originError = enforceSameOrigin(request);
    if (originError) {
      return originError;
    }

    const rateLimitError = enforceRateLimit(request, "upload", {
      limit: 10,
      windowMs: 60_000,
    });
    if (rateLimitError) {
      return rateLimitError;
    }

    const context = await requireWorkspaceContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const templateField = formData.get("template");
    const projectIdField = formData.get("projectId");
    const estimatedDurationField = formData.get("estimatedDurationSeconds");
    const templateResolution = await resolveTemplateSelectionForUser(
      context.user.id,
      typeof templateField === "string" ? templateField : undefined,
      context.activeWorkspace.id,
    );
    const template = templateResolution.storedTemplate;
    const projectId =
      typeof projectIdField === "string" && projectIdField.trim()
        ? projectIdField.trim()
        : null;
    const estimatedDurationSeconds =
      typeof estimatedDurationField === "string" &&
      estimatedDurationField.trim() &&
      Number.isFinite(Number(estimatedDurationField))
        ? Number(estimatedDurationField)
        : null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    await ensureCreditsAvailableForExpectedProcessing(
      context.user.id,
      estimatedDurationSeconds,
    );

    if (file.size === 0) {
      return NextResponse.json({ error: "Uploaded file is empty" }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File exceeds the 500MB upload limit" },
        { status: 413 },
      );
    }

    if (!ALLOWED_UPLOAD_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 415 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = sanitizeFilename(file.name || "upload");
    const key = `users/${context.user.id}/${Date.now()}-${safeName}`;
    uploadedKey = key;

    if (projectId) {
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          OR: [
            { workspaceId: context.activeWorkspace.id },
            { workspaceId: null, userId: context.user.id },
          ],
        } as any,
        select: { id: true },
      });
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }

    const transcription = await prisma.transcription.create({
      data: {
        userId: context.user.id,
        workspaceId: context.activeWorkspace.id,
        projectId,
        fileName: file.name || safeName,
        fileUrl: key,
        status: "uploading",
        template,
        searchText: buildTranscriptionSearchText({
          fileName: file.name || safeName,
          template,
        }),
      } as any,
      select: { id: true },
    });
    transcriptionId = transcription.id;

    const upload = await uploadToS3({
      key,
      body: buffer,
      contentType: file.type || "application/octet-stream",
    });

    await prisma.transcription.update({
      where: { id: transcription.id },
      data: {
        fileUrl: upload.key,
        status: "uploaded",
      },
    });

    try {
      console.info("Inngest enqueue attempt", getInngestDebugSnapshot());
      await inngest.send({
        name: "voxly/audio.uploaded",
        data: {
          transcriptionId: transcription.id,
          fileKey: upload.key,
          template,
        },
      });
    } catch (err) {
      console.error("Inngest enqueue failed", {
        debug: getInngestDebugSnapshot(),
        error: err instanceof Error ? err.message : String(err),
      });
      if (shouldProcessInline(err) && isLocalDevelopment()) {
        console.warn(
          "Inngest enqueue failed in local development; background processing must be started manually.",
          err,
        );
      } else {
        console.error("Failed to enqueue uploaded audio for background processing", err);
      }

      try {
        await deleteFromS3({ key: upload.key });
      } catch (cleanupError) {
        console.warn("Failed to clean up uploaded file after enqueue error", cleanupError);
      }

      await prisma.transcription.update({
        where: { id: transcription.id },
        data: { status: "error" },
      });
      const message =
        err instanceof Error ? err.message : "Failed to enqueue transcription";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      transcriptionId: transcription.id,
      key: upload.key,
      queued: true,
    });
  } catch (err) {
    if (transcriptionId) {
      try {
        await prisma.transcription.update({
          where: { id: transcriptionId },
          data: { status: "error" },
        });
      } catch (updateError) {
        console.warn("Failed to mark upload error state", updateError);
      }
    }

    if (uploadedKey) {
      try {
        await deleteFromS3({ key: uploadedKey });
      } catch (cleanupError) {
        console.warn("Failed to clean up uploaded file after upload error", cleanupError);
      }
    }

    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      {
        status:
          err instanceof Error && "statusCode" in err && typeof err.statusCode === "number"
            ? err.statusCode
            : getApiErrorStatus(err),
      },
    );
  }
}
