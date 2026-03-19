function splitSentences(transcript) {
  return String(transcript || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeTaskText(text) {
  return String(text || "")
    .replace(/^[,:;\-\s]+/, "")
    .replace(/[.!?]+$/, "")
    .trim();
}

function extractChecklistTasks(transcript) {
  const text = String(transcript || "");
  const tasks = [];
  const seen = new Set();
  const patterns = [
    /\b(?:first|second|third|fourth|fifth|then|next|finally)\b[:,]?\s*([^.!?]+)/gi,
    /\b(?:remember to|don't forget to|do not forget to)\b\s*([^.!?]+)/gi,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const task = normalizeTaskText(match[1]);
      const key = task.toLowerCase();
      if (!task || seen.has(key)) continue;
      seen.add(key);
      tasks.push(task);
    }
  }

  return tasks;
}

function toActionItems(tasks) {
  return tasks.map((task) => ({
    text: task,
    priority: "MEDIUM",
    assignee: "Unassigned",
  }));
}

function needsFallback(summary) {
  const hasDecisions = Array.isArray(summary?.decisions) && summary.decisions.length > 0;
  const hasKeyPoints = Array.isArray(summary?.keyPoints) && summary.keyPoints.length > 0;
  const hasNextSteps = Array.isArray(summary?.nextSteps) && summary.nextSteps.length > 0;
  const hasActionItems =
    Array.isArray(summary?.actionItems) && summary.actionItems.length > 0;
  return !hasDecisions && !hasKeyPoints && !hasNextSteps && !hasActionItems;
}

export function applySummaryFallback(summary, transcript) {
  if (!needsFallback(summary)) return summary;

  const sentences = splitSentences(transcript);
  const tasks = extractChecklistTasks(transcript);

  const keyPoints = [];
  if (sentences[0]) {
    keyPoints.push(sentences[0]);
  }
  if (tasks.length > 0) {
    keyPoints.push("Checklist items were captured from the voice memo.");
  }

  const nextSteps = tasks.length > 0 ? tasks : [];
  const actionItems = tasks.length > 0 ? toActionItems(tasks) : [];

  return {
    decisions: Array.isArray(summary?.decisions) ? summary.decisions : [],
    keyPoints,
    nextSteps,
    actionItems,
  };
}

