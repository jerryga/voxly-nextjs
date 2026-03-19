import { prisma } from "@/lib/prisma";
import { getSignedFileUrl } from "@/lib/storage/s3";
import { transcribeFromUrl } from "@/lib/deepgram";
import { summarizeTranscript } from "@/lib/llm/agent";

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
    select: { id: true, template: true },
  });

  if (!transcription) {
    throw new Error(`Transcription not found: ${transcriptionId}`);
  }

  const effectiveTemplate = template || transcription.template || "default";

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

    if (!transcriptText) {
      throw new Error("Transcription returned empty text");
    }

    const summary = await summarizeTranscript(transcriptText, {
      template: effectiveTemplate,
    });

    await prisma.transcription.update({
      where: { id: transcriptionId },
      data: {
        transcript: transcriptText,
        decisions: summary.decisions,
        keyPoints: summary.keyPoints,
        nextSteps: summary.nextSteps,
        actionItems: summary.actionItems,
        status: "done",
      },
    });

    return { transcriptionId };
  } catch (err) {
    await markTranscriptionError(transcriptionId);
    throw err;
  }
}

