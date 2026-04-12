type ProjectTranscriptRecord = {
  id: string;
  fileName: string;
  transcript: string | null;
  projectId?: string | null;
  project?: {
    id?: string | null;
    name?: string | null;
  } | null;
  decisions?: unknown;
  keyPoints?: unknown;
  nextSteps?: unknown;
  actionItems?: unknown;
};

export type ProjectContextChunk = {
  sourceId: string;
  transcriptionId: string;
  fileName: string;
  projectId?: string | null;
  projectName?: string | null;
  excerpt: string;
  score: number;
};

function flattenStrings(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => flattenStrings(item))
      .filter((item) => typeof item === "string" && item.trim().length > 0);
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((item) =>
      flattenStrings(item),
    );
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return [];
}

function splitTranscript(text: string) {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function chunkTranscript(text: string, maxLength = 1200) {
  const paragraphs = splitTranscript(text);
  if (paragraphs.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (!current) {
      current = paragraph;
      continue;
    }

    if ((current + "\n\n" + paragraph).length <= maxLength) {
      current += `\n\n${paragraph}`;
      continue;
    }

    chunks.push(current);
    current = paragraph;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function tokenize(text: string) {
  return String(text || "")
    .toLowerCase()
    .match(/[a-z0-9]{3,}/g) || [];
}

function rankChunk(query: string, chunk: string, fileName: string) {
  const q = tokenize(query);
  const haystack = `${fileName}\n${chunk}`.toLowerCase();
  let score = 0;

  for (const token of q) {
    if (haystack.includes(token)) {
      score += 5;
    }
  }

  if (q.length === 0) {
    score += 1;
  }

  score += Math.max(1, Math.min(4, Math.floor(chunk.length / 300)));
  return score;
}

export function buildProjectContextChunks(
  transcripts: ProjectTranscriptRecord[],
  question: string,
  {
    maxChunks = 12,
    maxTranscriptChunks = 3,
  }: {
    maxChunks?: number;
    maxTranscriptChunks?: number;
  } = {},
) {
  const chunks: ProjectContextChunk[] = [];

  transcripts.forEach((transcript) => {
    const transcriptChunks = chunkTranscript(transcript.transcript || "");
    const projectName = transcript.project?.name?.trim() || null;
    const projectId = transcript.project?.id || transcript.projectId || null;
    const summaryStrings = [
      ...flattenStrings(transcript.decisions),
      ...flattenStrings(transcript.keyPoints),
      ...flattenStrings(transcript.nextSteps),
      ...flattenStrings(transcript.actionItems),
    ];

    const mergedChunks = [
      ...summaryStrings.slice(0, 6),
      ...transcriptChunks.slice(0, 12),
    ]
      .filter(Boolean)
      .map((excerpt, index) => ({
        sourceId: `${transcript.id}:${index + 1}`,
        transcriptionId: transcript.id,
        fileName: transcript.fileName,
        projectId,
        projectName,
        excerpt,
        score: rankChunk(question, excerpt, transcript.fileName),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxTranscriptChunks);

    chunks.push(...mergedChunks);
  });

  return chunks.sort((a, b) => b.score - a.score).slice(0, maxChunks);
}

export function buildProjectIntelligencePrompt({
  question,
  projectName,
  chunks,
}: {
  question: string;
  projectName: string;
  chunks: ProjectContextChunk[];
}) {
  const contextBlock = chunks
    .map(
      (chunk) =>
        `[${chunk.sourceId}] ${chunk.fileName}${
          chunk.projectName ? `\nProject: ${chunk.projectName}` : ""
        }\n${chunk.excerpt}`,
    )
    .join("\n\n---\n\n");

  return `You are a grounded project intelligence assistant for Voxly.

Answer the user's question using ONLY the provided transcript excerpts.
If the context is incomplete, say so briefly instead of guessing.
Do not invent facts, names, decisions, or action items.
Always cite the supporting sourceIds you used.

Return valid JSON only in this shape:
{
  "answer": "Concise but useful answer in Markdown-friendly plain text.",
  "sourceIds": ["source-id-1", "source-id-2"],
  "confidenceNote": "Optional short note about uncertainty."
}

Project:
${projectName}

Question:
${question}

Transcript excerpts:
${contextBlock}`;
}

export function buildWorkspaceIntelligencePrompt({
  question,
  workspaceName,
  chunks,
}: {
  question: string;
  workspaceName: string;
  chunks: ProjectContextChunk[];
}) {
  const contextBlock = chunks
    .map(
      (chunk) =>
        `[${chunk.sourceId}] ${chunk.fileName}${
          chunk.projectName ? `\nProject: ${chunk.projectName}` : "\nProject: Unassigned"
        }\n${chunk.excerpt}`,
    )
    .join("\n\n---\n\n");

  return `You are a grounded workspace intelligence assistant for Voxly.

Answer the user's question using ONLY the provided transcript excerpts.
If the context is incomplete, say so briefly instead of guessing.
Do not invent facts, names, decisions, or action items.
Synthesize across recordings where useful, but stay anchored to evidence.
When the user asks about projects, compare or group by the Project line attached to each excerpt.
Always cite the supporting sourceIds you used.

Return valid JSON only in this shape:
{
  "answer": "Concise but useful answer in Markdown-friendly plain text.",
  "sourceIds": ["source-id-1", "source-id-2"],
  "confidenceNote": "Optional short note about uncertainty."
}

Workspace:
${workspaceName}

Question:
${question}

Transcript excerpts:
${contextBlock}`;
}
