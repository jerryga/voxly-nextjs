import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFromS3, uploadToS3 } from "@/lib/storage/s3";
import { inngest } from "@/inngest/client";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { ensureCreditsAvailableForExpectedProcessing } from "@/lib/billing";
import { enforceRateLimit, enforceSameOrigin } from "@/lib/api/security";
import { processUploadedAudio } from "@/lib/transcriptions/process";
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
} from "@/lib/api/validation";
import { normalizeTemplate } from "@/lib/llm/promptBuilder";

export const runtime = "nodejs";

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function shouldProcessInline(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return (
    process.env.NODE_ENV !== "production" &&
    (message.includes("Branch environment name is required") ||
      message.includes("Branch environment does not exist"))
  );
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

    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.toLowerCase().trim();

    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const templateField = formData.get("template");
    const estimatedDurationField = formData.get("estimatedDurationSeconds");
    const template =
      typeof templateField === "string" && templateField.trim()
        ? normalizeTemplate(templateField)
        : "default";
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
      user.id,
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
    const key = `users/${user.id}/${Date.now()}-${safeName}`;
    uploadedKey = key;

    const transcription = await prisma.transcription.create({
      data: {
        userId: user.id,
        fileName: file.name || safeName,
        fileUrl: key,
        status: "uploading",
        template,
      },
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

    const inngestEnv = process.env.INNGEST_ENV?.trim();

    try {
      await inngest.send({
        name: "voxly/audio.uploaded",
        data: {
          transcriptionId: transcription.id,
          fileKey: upload.key,
          template,
        },
      }, inngestEnv ? { env: inngestEnv } : undefined);
    } catch (err) {
      if (shouldProcessInline(err)) {
        await processUploadedAudio({
          transcriptionId: transcription.id,
          fileKey: upload.key,
          template,
        });

        return NextResponse.json({
          ok: true,
          transcriptionId: transcription.id,
          key: upload.key,
          queued: false,
          processedInline: true,
        });
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
