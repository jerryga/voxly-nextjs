import { prisma } from "@/lib/prisma";
import { normalizeTemplate } from "@/lib/llm/promptBuilder";

export const CUSTOM_TEMPLATE_PREFIX = "custom:";

export const builtInTemplateOptions = [
  { id: "default", label: "Default Template (Default)" },
  { id: "brainstorm", label: "Brainstorm Session" },
  { id: "interview", label: "Interview Notes" },
  { id: "lecture", label: "Lecture Notes" },
  { id: "voice-memo", label: "Voice Memo Notes" },
] as const;

export function slugifyTemplateName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function isCustomTemplateValue(value?: string | null) {
  return typeof value === "string" && value.startsWith(CUSTOM_TEMPLATE_PREFIX);
}

export function normalizeTemplateSelection(value?: string | null) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "default";
  }

  if (isCustomTemplateValue(trimmed)) {
    return trimmed;
  }

  return normalizeTemplate(trimmed);
}

export async function resolveTemplateSelectionForUser(
  userId: string,
  value?: string | null,
) {
  const normalizedValue = normalizeTemplateSelection(value);
  if (!isCustomTemplateValue(normalizedValue)) {
    return {
      storedTemplate: normalizedValue,
      builtInTemplate: normalizeTemplate(normalizedValue),
      customInstructions: undefined,
    };
  }

  const templateId = normalizedValue.slice(CUSTOM_TEMPLATE_PREFIX.length).trim();
  if (!templateId) {
    throw new Error("Invalid custom template");
  }

  const customTemplate = await prisma.summaryTemplate.findFirst({
    where: { id: templateId, userId },
    select: {
      id: true,
      baseTemplate: true,
      promptInstructions: true,
    },
  });

  if (!customTemplate) {
    throw new Error("Custom template not found");
  }

  return {
    storedTemplate: `${CUSTOM_TEMPLATE_PREFIX}${customTemplate.id}`,
    builtInTemplate: normalizeTemplate(customTemplate.baseTemplate),
    customInstructions: customTemplate.promptInstructions.trim() || undefined,
  };
}
