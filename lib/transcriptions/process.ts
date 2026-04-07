import { prisma } from "@/lib/prisma";
import {
  applyUsageCredits,
  ensureCreditsAvailableForProcessing,
  hasUsageCreditsApplied,
  refundUsageCredits,
} from "@/lib/billing";
import { getSignedFileUrl } from "@/lib/storage/s3";
import { transcribeFromUrl } from "@/lib/deepgram";
import { formatTranscript, summarizeTranscript } from "@/lib/llm/agent";
import { buildTranscriptionSearchText } from "@/lib/transcriptions/searchText";
import { resolveTemplateSelectionForUser } from "@/lib/templates";

type DeepgramResult = {
  metadata?: {
    duration?: number;
  };
  results?: {
    utterances?: Array<{
      speaker?: number | string;
      transcript?: string;
      start?: number;
      end?: number;
    }>;
    channels?: Array<{
      alternatives?: Array<{
        transcript?: string;
        paragraphs?: {
          transcript?: string;
          paragraphs?: Array<{
            sentences?: Array<{
              text?: string;
              start?: number;
              end?: number;
            }>;
            start?: number;
            end?: number;
          }>;
        };
      }>;
    }>;
  };
};

function formatTimestamp(seconds?: number) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) {
    return null;
  }

  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const secs = wholeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function shouldMergeUtterances(
  currentText: string,
  nextText: string,
  currentSpeaker: string,
  nextSpeaker: string,
) {
  if (currentSpeaker !== nextSpeaker) {
    return false;
  }

  const currentWordCount = currentText.split(/\s+/).filter(Boolean).length;
  const nextWordCount = nextText.split(/\s+/).filter(Boolean).length;

  if (currentWordCount <= 6 || nextWordCount <= 6) {
    return true;
  }

  if (!/[.!?]["']?$/.test(currentText)) {
    return true;
  }

  return /^[a-z0-9,(]/i.test(nextText);
}

function extractRawTranscript(result: DeepgramResult) {
  return (
    result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || ""
  ).trim();
}

function extractFormattedUtterances(result: DeepgramResult) {
  const utterances = result?.results?.utterances;
  if (!Array.isArray(utterances) || utterances.length === 0) {
    return "";
  }

  const mergedBlocks: Array<{
    speaker: string;
    start?: number;
    text: string;
  }> = [];

  for (const utterance of utterances) {
    const transcript = utterance?.transcript?.trim();
    if (!transcript) {
      continue;
    }

    const speaker =
      utterance?.speaker === undefined || utterance?.speaker === null
        ? "Speaker"
        : `Speaker ${utterance.speaker}`;
    const lastBlock = mergedBlocks[mergedBlocks.length - 1];

    if (
      lastBlock &&
      shouldMergeUtterances(lastBlock.text, transcript, lastBlock.speaker, speaker)
    ) {
      lastBlock.text = `${lastBlock.text} ${transcript}`.replace(/\s+/g, " ").trim();
      continue;
    }

    mergedBlocks.push({
      speaker,
      start: utterance?.start,
      text: transcript,
    });
  }

  return mergedBlocks
    .map((block) => {
      const timestamp = formatTimestamp(block.start);
      return timestamp
        ? `[${timestamp}] ${block.speaker}: ${block.text}`
        : `${block.speaker}: ${block.text}`;
    })
    .join("\n\n");
}

function extractFormattedParagraphs(result: DeepgramResult) {
  const paragraphs =
    result?.results?.channels?.[0]?.alternatives?.[0]?.paragraphs?.paragraphs;
  if (!Array.isArray(paragraphs) || paragraphs.length === 0) {
    return "";
  }

  return paragraphs
    .map((paragraph) =>
      (paragraph?.sentences || [])
        .map((sentence) => sentence?.text?.trim() || "")
        .filter(Boolean)
        .join(" "),
    )
    .filter(Boolean)
    .join("\n\n");
}

function extractReadableTranscript(result: DeepgramResult) {
  const utteranceTranscript = extractFormattedUtterances(result);
  if (utteranceTranscript) {
    return utteranceTranscript;
  }

  const paragraphTranscript = extractFormattedParagraphs(result);
  if (paragraphTranscript) {
    return paragraphTranscript;
  }

  return (
    extractRawTranscript(result)
  ).trim();
}

function extractDurationSeconds(result: DeepgramResult) {
  const duration = result?.metadata?.duration;
  return typeof duration === "number" && Number.isFinite(duration)
    ? duration
    : null;
}

export function hasPersistedTranscriptionResult(transcription: {
  status?: string | null;
  transcript?: string | null;
  decisions?: unknown;
  keyPoints?: unknown;
  nextSteps?: unknown;
  actionItems?: unknown;
}) {
  const decisionsCount = Array.isArray(transcription.decisions)
    ? transcription.decisions.length
    : 0;
  const keyPointsCount = Array.isArray(transcription.keyPoints)
    ? transcription.keyPoints.length
    : 0;
  const nextStepsCount = Array.isArray(transcription.nextSteps)
    ? transcription.nextSteps.length
    : 0;
  const actionItemsCount = Array.isArray(transcription.actionItems)
    ? transcription.actionItems.length
    : 0;

  return (
    transcription.status === "done" &&
    !!transcription.transcript &&
    (
      decisionsCount > 0 ||
      keyPointsCount > 0 ||
      nextStepsCount > 0 ||
      actionItemsCount > 0
    )
  );
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
    select: {
      id: true,
      fileName: true,
      template: true,
      userId: true,
      status: true,
      transcript: true,
      rawTranscript: true,
      formattedTranscript: true,
      decisions: true,
      keyPoints: true,
      nextSteps: true,
      actionItems: true,
    },
  });

  if (!transcription) {
    throw new Error(`Transcription not found: ${transcriptionId}`);
  }

  const effectiveTemplate = template || transcription.template || "default";
  const templateResolution = await resolveTemplateSelectionForUser(
    transcription.userId,
    effectiveTemplate,
  );
  if (
    templateResolution.storedTemplate === (transcription.template || "default") &&
    hasPersistedTranscriptionResult(transcription)
  ) {
    return { transcriptionId, reusedExisting: true };
  }

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
    const rawTranscriptText = extractRawTranscript(deepgramResult);
    const readableTranscriptText = extractReadableTranscript(deepgramResult);
    const durationSeconds = extractDurationSeconds(deepgramResult);

    if (!rawTranscriptText) {
      throw new Error("Transcription returned empty text");
    }

    let formattedTranscriptText = readableTranscriptText;
    try {
      const aiFormattedTranscript = await formatTranscript(
        rawTranscriptText,
        readableTranscriptText,
        { template: templateResolution.builtInTemplate },
      );
      if (aiFormattedTranscript?.trim()) {
        formattedTranscriptText = aiFormattedTranscript.trim();
      }
    } catch (formattingError) {
      console.warn("Transcript formatting failed, using readable fallback", formattingError);
    }

    const effectiveTranscriptText =
      formattedTranscriptText?.trim() || readableTranscriptText || rawTranscriptText;

    const summary = await summarizeTranscript(effectiveTranscriptText, {
      template: templateResolution.builtInTemplate,
      customInstructions: templateResolution.customInstructions,
    });

    await applyUsageCredits({
      userId: transcription.userId,
      transcriptionId,
      durationSeconds,
    });

    await prisma.transcription.update({
      where: { id: transcriptionId },
      data: {
        rawTranscript: rawTranscriptText,
        formattedTranscript: formattedTranscriptText || null,
        transcript: effectiveTranscriptText,
        duration: durationSeconds ? Math.round(durationSeconds) : null,
        searchText: buildTranscriptionSearchText({
          fileName: transcription.fileName,
          template: templateResolution.storedTemplate,
          transcript: effectiveTranscriptText,
          decisions: summary.decisions,
          keyPoints: summary.keyPoints,
          nextSteps: summary.nextSteps,
          actionItems: summary.actionItems,
        }),
        decisions: summary.decisions,
        keyPoints: summary.keyPoints,
        nextSteps: summary.nextSteps,
        actionItems: summary.actionItems,
        template: templateResolution.storedTemplate,
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
