import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceRateLimit, enforceSameOrigin } from "@/lib/api/security";
import { processUploadedAudio } from "@/lib/transcriptions/process";
import { transcriptionProcessSchema } from "@/lib/api/validation";

export const runtime = "nodejs";

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

    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.toLowerCase().trim();

    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
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
      where: { id: transcriptionId, userId: user.id },
    });

    if (!transcription) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const key = transcription.fileUrl;
    if (!key) {
      return NextResponse.json({ error: "Missing file key" }, { status: 400 });
    }

    await prisma.transcription.update({
      where: { id: transcription.id },
      data: { status: "processing" },
    });

    const inngestEnv = process.env.INNGEST_ENV?.trim();

    try {
      await inngest.send({
        name: "voxly/audio.uploaded",
        data: {
          transcriptionId: transcription.id,
          fileKey: key,
          template: templateOverride || transcription.template || "default",
        },
      }, inngestEnv ? { env: inngestEnv } : undefined);
    } catch (err) {
      if (shouldProcessInline(err)) {
        await processUploadedAudio({
          transcriptionId: transcription.id,
          fileKey: key,
          template: templateOverride || transcription.template || "default",
        });

        return NextResponse.json({
          ok: true,
          transcriptionId: transcription.id,
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
      queued: true,
    });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
