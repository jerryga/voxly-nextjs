import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSignedFileUrl } from "@/lib/storage/s3";
import { transcribeFromUrl } from "@/lib/deepgram";
import { summarizeTranscript } from "@/lib/llm/agent";

export const runtime = "nodejs";

type DeepgramResult = {
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript?: string;
      }>;
    }>;
  };
};

function extractTranscript(result: DeepgramResult) {
  return (
    result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || ""
  ).trim();
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const transcriptionId =
    typeof body?.transcriptionId === "string" ? body.transcriptionId : "";
  const templateOverride =
    typeof body?.template === "string" ? body.template : undefined;

  if (!transcriptionId) {
    return NextResponse.json(
      { error: "transcriptionId is required" },
      { status: 400 },
    );
  }

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

  const signedUrl = await getSignedFileUrl({
    key,
    bucket: process.env.S3_BUCKET_NAME || process.env.S3_BUCKET,
  });
  const deepgramResult = await transcribeFromUrl(signedUrl);
  const transcriptText = extractTranscript(deepgramResult);

  if (!transcriptText) {
    await prisma.transcription.update({
      where: { id: transcription.id },
      data: { status: "error" },
    });
    return NextResponse.json(
      { error: "Transcription returned empty text" },
      { status: 502 },
    );
  }

  const summary = await summarizeTranscript(transcriptText, {
    template: templateOverride || transcription.template || "default",
  });

  await prisma.transcription.update({
    where: { id: transcription.id },
    data: {
      transcript: transcriptText,
      decisions: summary.decisions,
      keyPoints: summary.keyPoints,
      nextSteps: summary.nextSteps,
      actionItems: summary.actionItems,
      status: "done",
    },
  });

  return NextResponse.json({
    ok: true,
    transcriptionId: transcription.id,
    transcript: transcriptText,
    summary,
  });
}
