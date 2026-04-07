type ActionItemLike = {
  text?: unknown;
  assignee?: unknown;
  priority?: unknown;
};

function normalizeChunk(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function flattenStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeChunk(item))
    .filter(Boolean);
}

function flattenActionItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const actionItem = item as ActionItemLike;
    return [
      normalizeChunk(actionItem.text),
      normalizeChunk(actionItem.assignee),
      normalizeChunk(actionItem.priority),
    ].filter(Boolean);
  });
}

export function buildTranscriptionSearchText(input: {
  fileName?: string | null;
  transcript?: string | null;
  template?: string | null;
  decisions?: unknown;
  keyPoints?: unknown;
  nextSteps?: unknown;
  actionItems?: unknown;
}) {
  const chunks = [
    normalizeChunk(input.fileName),
    normalizeChunk(input.template),
    normalizeChunk(input.transcript),
    ...flattenStringArray(input.decisions),
    ...flattenStringArray(input.keyPoints),
    ...flattenStringArray(input.nextSteps),
    ...flattenActionItems(input.actionItems),
  ].filter(Boolean);

  return chunks.length ? chunks.join("\n") : null;
}
