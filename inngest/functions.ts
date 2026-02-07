import { inngest } from "./client";
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

export type AudioUploadedEvent = {
  name: "voxly/audio.uploaded";
  data: {
    transcriptionId: string;
    fileKey: string;
    template?: string | null;
    bucket?: string;
  };
};

type StepRunner = {
  run: <T>(name: string, fn: () => Promise<T> | T) => Promise<T>;
};

async function markTranscriptionError(transcriptionId: string) {
  try {
    await prisma.transcription.update({
      where: { id: transcriptionId },
      data: { status: "error" },
    });
  } catch (err) {
    console.warn("Failed to mark transcription error", err);
  }
}

export const processMeetingAudio = inngest.createFunction(
  { id: "process-meeting-audio", retries: 3 },
  { event: "voxly/audio.uploaded" },
  async ({ event, step }: { event: AudioUploadedEvent; step: StepRunner }) => {
    const { transcriptionId, fileKey, template, bucket } = event.data;

    if (!transcriptionId || !fileKey) {
      throw new Error("Missing transcriptionId or fileKey");
    }

    try {
      const transcription = await step.run("load-transcription", () =>
        prisma.transcription.findUnique({
          where: { id: transcriptionId },
          select: { id: true, template: true },
        }),
      );

      if (!transcription) {
        throw new Error(`Transcription not found: ${transcriptionId}`);
      }

      const effectiveTemplate = template || transcription.template || "default";

      await step.run("mark-processing", () =>
        prisma.transcription.update({
          where: { id: transcriptionId },
          data: { status: "processing" },
        }),
      );

      const signedUrl = await step.run("sign-file-url", () =>
        getSignedFileUrl({
          key: fileKey,
          bucket,
          expiresIn: 3600,
        }),
      );

      const deepgramResult = await step.run("transcribe-audio", () =>
        transcribeFromUrl(signedUrl),
      );
      const transcriptText = extractTranscript(deepgramResult);

      if (!transcriptText) {
        throw new Error("Transcription returned empty text");
      }

      const summary = await step.run("generate-summary", () =>
        summarizeTranscript(transcriptText, { template: effectiveTemplate }),
      );

      await step.run("update-db", () =>
        prisma.transcription.update({
          where: { id: transcriptionId },
          data: {
            transcript: transcriptText,
            decisions: summary.decisions,
            keyPoints: summary.keyPoints,
            nextSteps: summary.nextSteps,
            actionItems: summary.actionItems,
            status: "done",
          },
        }),
      );

      return { transcriptionId };
    } catch (err) {
      await step.run("mark-error", () =>
        markTranscriptionError(transcriptionId),
      );
      throw err;
    }
  },
);
