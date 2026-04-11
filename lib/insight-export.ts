type InsightSource = {
  sourceId?: string;
  fileName?: string;
  excerpt?: string;
};

type InsightExportInput = {
  title: string;
  scopeLabel: string;
  question: string;
  answer: string;
  confidenceNote?: string | null;
  createdAt: Date | string;
  sourceCount?: number;
  sources?: unknown;
};

function normalizeSources(sources: unknown): InsightSource[] {
  if (!Array.isArray(sources)) {
    return [];
  }

  return sources.flatMap((source) => {
      if (!source || typeof source !== "object") {
        return [];
      }

      const item = source as Record<string, unknown>;
      const normalized = {
        sourceId:
          typeof item.sourceId === "string" ? item.sourceId.trim() : undefined,
        fileName:
          typeof item.fileName === "string" ? item.fileName.trim() : undefined,
        excerpt:
          typeof item.excerpt === "string" ? item.excerpt.trim() : undefined,
      };
      return normalized.fileName || normalized.excerpt ? [normalized] : [];
    });
}

export function formatInsightMarkdownForNotion(input: InsightExportInput) {
  const createdAt =
    input.createdAt instanceof Date
      ? input.createdAt.toISOString()
      : new Date(input.createdAt).toISOString();
  const sources = normalizeSources(input.sources);

  const sourceSection = sources.length
    ? sources
        .map((source, index) => {
          const header = `### Source ${index + 1}${source.fileName ? `: ${source.fileName}` : ""}`;
          const excerpt = source.excerpt ? `> ${source.excerpt.replace(/\n/g, "\n> ")}` : "> No excerpt available.";
          const sourceId = source.sourceId ? `\nSource ID: \`${source.sourceId}\`` : "";
          return [header, "", excerpt, sourceId].filter(Boolean).join("\n");
        })
        .join("\n\n")
    : "No cited sources were saved with this insight.";

  return [
    `# ${input.title}`,
    "",
    `- Scope: ${input.scopeLabel}`,
    `- Created: ${createdAt}`,
    `- Sources: ${input.sourceCount ?? sources.length}`,
    "",
    "## Question",
    input.question.trim(),
    "",
    "## Answer",
    input.answer.trim(),
    "",
    "## Confidence Note",
    input.confidenceNote?.trim() || "None",
    "",
    "## Sources",
    sourceSection,
    "",
  ].join("\n");
}
