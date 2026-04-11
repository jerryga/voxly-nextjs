/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { ensureCreditsAvailableForExpectedProcessing } from "@/lib/billing";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceRateLimit, enforceSameOrigin } from "@/lib/api/security";
import { hasPersistedTranscriptionResult } from "@/lib/transcriptions/process";
import { transcriptionProcessSchema } from "@/lib/api/validation";
import { resolveTemplateSelectionForUser } from "@/lib/templates";
import { requireWorkspaceContext } from "@/lib/workspaces";

export const runtime = "nodejs";

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
  try {
    const originError = enforceSameOrigin(request);
    if (originError) {
      return originError;
    }

    const rateLimitError = enforceRateLimit(request, "transcription-process", {
      limit: 20,
      windowMs: 60_000,
    });
    if (rateLimitError) {
      return rateLimitError;
    }

    const context = await requireWorkspaceContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = transcriptionProcessSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const { transcriptionId, template: templateOverride } = parsed.data;

    const transcription = await prisma.transcription.findFirst({
      where: {
        id: transcriptionId,
        OR: [
          { workspaceId: context.activeWorkspace.id },
          { workspaceId: null, userId: context.user.id },
        ],
      } as any,
    });

    if (!transcription) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const effectiveTemplate = templateOverride
      ? (await resolveTemplateSelectionForUser(
          context.user.id,
          templateOverride,
          context.activeWorkspace.id,
        )).storedTemplate
      : undefined;
    const currentTemplate = transcription.template || "default";
    if (
      (!effectiveTemplate || effectiveTemplate === currentTemplate) &&
      hasPersistedTranscriptionResult(transcription)
    ) {
      return NextResponse.json({
        ok: true,
        transcriptionId: transcription.id,
        queued: false,
        reusedExisting: true,
      });
    }

    await ensureCreditsAvailableForExpectedProcessing(
      context.user.id,
      transcription.duration,
    );

    const key = transcription.fileUrl;
    if (!key) {
      return NextResponse.json({ error: "Missing file key" }, { status: 400 });
    }

    await prisma.transcription.update({
      where: { id: transcription.id },
      data: { status: "processing" },
    });

    try {
      console.info("Inngest reprocess enqueue attempt", getInngestDebugSnapshot());
      await inngest.send({
        name: "voxly/audio.uploaded",
        data: {
          transcriptionId: transcription.id,
          fileKey: key,
          template: effectiveTemplate || currentTemplate,
        },
      });
    } catch (err) {
      console.error("Inngest reprocess enqueue failed", {
        debug: getInngestDebugSnapshot(),
        error: err instanceof Error ? err.message : String(err),
      });
      if (shouldProcessInline(err) && isLocalDevelopment()) {
        console.warn(
          "Inngest enqueue failed in local development; background processing must be started manually.",
          err,
        );
      } else {
        console.error("Failed to enqueue transcription for background processing", err);
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
      queued: true,
    });
  } catch (err) {
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
