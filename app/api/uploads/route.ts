import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadToS3 } from "@/lib/storage/s3";
import { inngest } from "@/inngest/client";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { processUploadedAudio } from "@/lib/transcriptions/process";

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
  try {
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
    const template =
      typeof templateField === "string" && templateField.trim()
        ? templateField.trim()
        : "default";

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = sanitizeFilename(file.name || "upload");
    const key = `users/${user.id}/${Date.now()}-${safeName}`;

    const upload = await uploadToS3({
      key,
      body: buffer,
      contentType: file.type || "application/octet-stream",
    });

    const transcription = await prisma.transcription.create({
      data: {
        userId: user.id,
        fileName: file.name || safeName,
        fileUrl: upload.key,
        status: "processing",
        template,
      },
      select: { id: true },
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
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
