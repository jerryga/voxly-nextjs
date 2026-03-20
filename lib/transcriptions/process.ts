import { prisma } from "@/lib/prisma";
import {
  applyUsageCredits,
  ensureCreditsAvailableForProcessing,
  hasUsageCreditsApplied,
  refundUsageCredits,
} from "@/lib/billing";
import { getSignedFileUrl } from "@/lib/storage/s3";
import { transcribeFromUrl } from "@/lib/deepgram";
import { summarizeTranscript } from "@/lib/llm/agent";

type DeepgramResult = {
  metadata?: {
    duration?: number;
  };
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

function extractDurationSeconds(result: DeepgramResult) {
  const duration = result?.metadata?.duration;
  return typeof duration === "number" && Number.isFinite(duration)
    ? duration
    : null;
}

export async function markTranscriptionError(transcriptionId: string) {
  try {
    await prisma.transcription.update({
      where: { id: transcriptionId },
      data: { status: "error" },
    });
  } catch (err) {
    console.warn("Failed to mark transcription error", err);
  }
}

export async function processUploadedAudio({
  transcriptionId,
  fileKey,
  template,
  bucket,
}: {
  transcriptionId: string;
  fileKey: string;
  template?: string | null;
  bucket?: string;
}) {
  if (!transcriptionId || !fileKey) {
    throw new Error("Missing transcriptionId or fileKey");
  }

  const transcription = await prisma.transcription.findUnique({
    where: { id: transcriptionId },
    select: { id: true, template: true, userId: true, status: true },
  });

  if (!transcription) {
    throw new Error(`Transcription not found: ${transcriptionId}`);
  }

  const effectiveTemplate = template || transcription.template || "default";
  const hasExistingUsageCharge = await hasUsageCreditsApplied(transcriptionId);
  if (!hasExistingUsageCharge) {
    await ensureCreditsAvailableForProcessing(transcription.userId);
  }

  if (
    !["uploaded", "processing", "done", "error"].includes(transcription.status)
  ) {
    throw new Error(`Transcription is not ready for processing: ${transcription.status}`);
  }

  await prisma.transcription.update({
    where: { id: transcriptionId },
    data: { status: "processing" },
  });

  try {
    const signedUrl = await getSignedFileUrl({
      key: fileKey,
      bucket,
      expiresIn: 3600,
    });

    const deepgramResult = await transcribeFromUrl(signedUrl);
    const transcriptText = extractTranscript(deepgramResult);
    const durationSeconds = extractDurationSeconds(deepgramResult);

    if (!transcriptText) {
      throw new Error("Transcription returned empty text");
    }

    const summary = await summarizeTranscript(transcriptText, {
      template: effectiveTemplate,
    });

    await applyUsageCredits({
      userId: transcription.userId,
      transcriptionId,
      durationSeconds,
    });

    await prisma.transcription.update({
      where: { id: transcriptionId },
      data: {
        transcript: transcriptText,
        duration: durationSeconds ? Math.round(durationSeconds) : null,
        decisions: summary.decisions,
        keyPoints: summary.keyPoints,
        nextSteps: summary.nextSteps,
        actionItems: summary.actionItems,
        status: "done",
      },
    });

    return { transcriptionId };
  } catch (err) {
    await refundUsageCredits({
      userId: transcription.userId,
      transcriptionId,
      reason: "Credits restored after processing failed",
    });
    await markTranscriptionError(transcriptionId);
    throw err;
  }
}
