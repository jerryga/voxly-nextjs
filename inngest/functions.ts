import { inngest } from "./client";
import { processUploadedAudio } from "@/lib/transcriptions/process";
import { prisma } from "@/lib/prisma";
import { sendSessionReadyEmail } from "@/lib/email/session-ready";

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

export const processMeetingAudio = inngest.createFunction(
  { id: "process-meeting-audio", retries: 3 },
  { event: "voxly/audio.uploaded" },
  async ({ event, step }: { event: AudioUploadedEvent; step: StepRunner }) => {
    const { transcriptionId, fileKey, template, bucket } = event.data;

    if (!transcriptionId || !fileKey) {
      throw new Error("Missing transcriptionId or fileKey");
    }

    const result = await step.run("process-uploaded-audio", () =>
      processUploadedAudio({
        transcriptionId,
        fileKey,
        template,
        bucket,
      }),
    );

    // Skip email when reusing an already-processed result to avoid duplicate sends
    if (!result.reusedExisting) {
      await step.run("send-session-ready-email", async () => {
        const tx = await prisma.transcription.findUnique({
          where: { id: transcriptionId },
          select: {
            id: true,
            fileName: true,
            keyPoints: true,
            status: true,
            user: { select: { email: true, name: true } },
          },
        });

        if (!tx || tx.status !== "done" || !tx.user?.email) {
          return { skipped: true };
        }

        const keyPoints = Array.isArray(tx.keyPoints) ? (tx.keyPoints as string[]) : [];
        const snippet =
          String(keyPoints[0] ?? "").trim().slice(0, 120) ||
          "Your recording has been processed.";

        const origin = process.env.NEXTAUTH_URL?.replace(/\/+$/, "") ?? "";

        return sendSessionReadyEmail({
          to: tx.user.email,
          userName: tx.user.name,
          fileName: tx.fileName,
          summarySnippet: snippet,
          sessionUrl: `${origin}/session/${transcriptionId}`,
        });
      });
    }

    return { transcriptionId };
  },
);
