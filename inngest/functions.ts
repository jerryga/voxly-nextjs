import { inngest } from "./client";
import { processUploadedAudio } from "@/lib/transcriptions/process";

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

    await step.run("process-uploaded-audio", () =>
      processUploadedAudio({
        transcriptionId,
        fileKey,
        template,
        bucket,
      }),
    );

    return { transcriptionId };
  },
);
