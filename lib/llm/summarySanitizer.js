const SPEAKER_PREFIX_PATTERN =
  /^(?:\[\d{1,2}:\d{2}(?::\d{2})?\]\s*)?(?:speaker\s*\d+|speaker)\s*:\s*/i;

function stripSpeakerPrefix(value) {
  return String(value || "")
    .trim()
    .replace(SPEAKER_PREFIX_PATTERN, "")
    .trim();
}

function sanitizeSummaryString(value) {
  const cleaned = stripSpeakerPrefix(value)
    .replace(/\s+/g, " ")
    .trim();

  return cleaned;
}

export function sanitizeSummaryStrings(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => sanitizeSummaryString(item))
    .filter(Boolean);
}

export function sanitizeActionItemText(value) {
  return sanitizeSummaryString(value);
}
