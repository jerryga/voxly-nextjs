import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildPrompt, normalizeTemplate } from "./promptBuilder.js";
import { applySummaryFallback } from "./summaryFallback.js";
import {
  sanitizeActionItemText,
  sanitizeSummaryStrings,
} from "./summarySanitizer.js";

const GEMINI_MODELS = (process.env.GEMINI_MODELS || "")
  .split(",")
  .map((m) => normalizeModel(m))
  .filter(Boolean);
const DEFAULT_GEMINI_MODEL = GEMINI_MODELS[0] || "gemini-2.5-flash";

let cachedGemini;
function getGemini() {
  if (cachedGemini) return cachedGemini;
  const apiKey =
    process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing env: GOOGLE_GEMINI_API_KEY (or GEMINI_API_KEY)");
  }
  cachedGemini = new GoogleGenerativeAI(apiKey);
  return cachedGemini;
}

function normalizeModel(model) {
  if (!model) return undefined;
  const m = model.trim();
  if (m === "gemini-2.5-flash") return "gemini-2.5-flash";
  return m;
}

function getModelCandidates(explicitModel) {
  if (explicitModel) return [normalizeModel(explicitModel)];
  if (GEMINI_MODELS.length) return GEMINI_MODELS;
  return [DEFAULT_GEMINI_MODEL];
}

async function withModelFallback(models, runner) {
  let lastError;
  for (const model of models) {
    try {
      return await runner(model);
    } catch (err) {
      lastError = err;
      const status = err?.status;
      const code = err?.code;
      const isRateLimited = status === 429 || code === "RESOURCE_EXHAUSTED";
      console.warn("Gemini model failed", {
        model,
        status,
        code,
        isRateLimited,
      });
      if (!isRateLimited) break;
      // try next model on rate limit
    }
  }
  throw lastError;
}

function normalize(parsed) {
  return {
    decisions: sanitizeSummaryStrings(parsed?.decisions),
    keyPoints: sanitizeSummaryStrings(parsed?.keyPoints),
    nextSteps: sanitizeSummaryStrings(parsed?.nextSteps),
    actionItems: normalizeActionItems(parsed?.actionItems),
  };
}

const DEFAULT_ASSIGNEE = "Unassigned";
const DEFAULT_PRIORITY = "MEDIUM";

function normalizePriority(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  if (
    normalized === "HIGH" ||
    normalized === "MEDIUM" ||
    normalized === "LOW"
  ) {
    return normalized;
  }
  return DEFAULT_PRIORITY;
}

function normalizeActionItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (typeof item === "string") {
        const text = sanitizeActionItemText(item);
        if (!text) return null;
        return {
          text,
          priority: DEFAULT_PRIORITY,
          assignee: DEFAULT_ASSIGNEE,
        };
      }
      if (!item || typeof item !== "object") return null;
      const text =
        typeof item.text === "string" ? sanitizeActionItemText(item.text) : "";
      if (!text) return null;
      const assignee =
        typeof item.assignee === "string" && item.assignee.trim()
          ? item.assignee.trim()
          : DEFAULT_ASSIGNEE;
      return {
        text,
        priority: normalizePriority(item.priority),
        assignee,
      };
    })
    .filter(Boolean);
}

function normalizeSummary(summary) {
  if (!summary || typeof summary !== "object") {
    return normalize({});
  }
  return normalize(summary);
}

function normalizeChatMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((m) => {
      if (!m || typeof m !== "object") return null;
      const role = m.role === "assistant" ? "assistant" : "user";
      const content = typeof m.content === "string" ? m.content.trim() : "";
      if (!content) return null;
      return { role, content };
    })
    .filter(Boolean);
}

function buildEditPrompt(summary, userPrompt) {
  const safeSummary = normalizeSummary(summary);
  const summaryJson = JSON.stringify(safeSummary, null, 2);
  return `You are an expert meeting notes editor. You will receive the current structured summary JSON and a user request. Update ONLY what is needed to fulfill the request and keep all other content intact. Maintain this exact JSON shape:
{
  "decisions": ["..."],
  "keyPoints": ["..."],
  "nextSteps": ["..."],
  "actionItems": [
    { "text": "...", "priority": "HIGH|MEDIUM|LOW", "assignee": "..." }
  ]
}

Constraints:
- Output valid JSON only, no prose.
- Do not invent names; if unsure, leave assignee unchanged or omit.
- Priorities must be HIGH, MEDIUM, or LOW.
- Keep arrays (use [] if empty).

Current summary JSON:
${summaryJson}

User request:
${userPrompt}

Return ONLY the updated JSON.`;
}

function parseJsonLoose(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
  }
  return {};
}

function getTranscriptFormattingTemplateInstructions(template) {
  const safeTemplate = normalizeTemplate(template);

  if (safeTemplate === "interview") {
    return `Template context: INTERVIEW
- Short questions often belong to the interviewer, and longer follow-up answers often belong to the interviewee.
- If a single block appears to contain an interviewer prompt followed by an interviewee answer, split it into separate speaker turns conservatively.
- You may reassign a speaker label when the question/answer structure is strongly supported by context.
- Prefer readable interview turn-taking over preserving obviously incorrect diarization labels.`;
  }

  if (safeTemplate === "lecture") {
    return `Template context: LECTURE
- Prefer longer coherent teaching/explanation blocks.
- Be conservative about changing speaker labels because many lectures are effectively single-speaker.
- Focus on readability and paragraph flow more than speaker alternation.`;
  }

  if (safeTemplate === "voice-memo") {
    return `Template context: VOICE MEMO
- Most content is likely from a single speaker.
- Focus on readability, punctuation, and paragraphing.
- Avoid reassigning speaker labels unless the transcript clearly contains more than one speaker.`;
  }

  if (safeTemplate === "brainstorm") {
    return `Template context: BRAINSTORM
- Preserve the fast back-and-forth nature of the conversation.
- Merge tiny fragments when they clearly belong to one speaker, but do not over-regularize the dialogue.
- Be conservative when reassigning speaker labels.`;
  }

  return `Template context: MEETING / DEFAULT
- Focus on readable speaker turns and paragraphs.
- Be conservative when changing speaker labels.
- Split obviously mixed question/answer blocks only when the context strongly supports it.`;
}

function buildTranscriptFormattingPrompt(rawTranscript, readableTranscript, template) {
  return `You are cleaning and formatting a transcript produced from speech-to-text.

Goal:
- Rewrite the transcript into readable speaker turns and paragraphs.
- Preserve the original meaning and wording as closely as possible.
- Do not summarize.
- Do not invent or remove substantive content.

Rules:
- Keep speaker labels like "Speaker 0", "Speaker 1" when possible.
- If a line clearly starts with a question from one speaker and the answer belongs to another, split them into separate blocks conservatively.
- Merge tiny fragments into natural utterances when they belong together.
- Keep timestamps only at the start of each speaker block when timestamps are present.
- If speaker attribution is uncertain, be conservative and avoid guessing beyond the provided context.
- Return plain text only. No markdown fences, no commentary.

${getTranscriptFormattingTemplateInstructions(template)}

Raw transcript:
${rawTranscript}

Readable transcript candidate:
${readableTranscript}

Return the cleaned transcript only.`;
}

export async function summarizeTranscriptGemini(
  transcript,
  { model, template } = {},
) {
  if (!transcript || !transcript.trim()) {
    throw new Error("summarizeTranscript requires transcript text");
  }
  const client = getGemini();
  const safeTemplate = normalizeTemplate(template);
  const prompt = buildPrompt(transcript, safeTemplate);
  const models = getModelCandidates(model);
  console.log("summarizeTranscriptGemini models", models);

  return withModelFallback(models, async (m) => {
    const genModel = client.getGenerativeModel({
      model: m,
      generationConfig: {
        temperature: 0.2,
        topP: 0.9,
        responseMimeType: "application/json",
      },
    });
    const result = await genModel.generateContent(prompt);
    const raw = result?.response?.text?.() || "{}";
    const parsed = parseJsonLoose(raw);
    return applySummaryFallback(normalize(parsed), transcript);
  });
}

export async function formatTranscriptGemini(
  rawTranscript,
  readableTranscript,
  { model, template } = {},
) {
  if (!rawTranscript || !String(rawTranscript).trim()) {
    throw new Error("formatTranscript requires raw transcript text");
  }

  const client = getGemini();
  const models = getModelCandidates(model);
  const promptText = buildTranscriptFormattingPrompt(
    rawTranscript,
    readableTranscript,
    template,
  );

  return withModelFallback(models, async (m) => {
    const genModel = client.getGenerativeModel({
      model: m,
      generationConfig: {
        temperature: 0.1,
        topP: 0.9,
        responseMimeType: "text/plain",
      },
    });

    const result = await genModel.generateContent(promptText);
    const text = result?.response?.text?.() || "";
    return text.trim();
  });
}

function buildChatPrompt(messages, summary) {
  const cleaned = normalizeChatMessages(messages);
  const history = cleaned
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");
  const summaryJson = JSON.stringify(normalizeSummary(summary), null, 2);
  return `You are a concise, helpful meeting copilot. You can reference the current structured summary JSON. Do not invent names. If unsure, say you don't know.

Current summary JSON:
${summaryJson}

Chat history:
${history}

Reply as the assistant.
`;
}

export async function applyAssistantChatGemini({
  messages,
  summary,
  model,
} = {}) {
  const cleaned = normalizeChatMessages(messages);
  if (cleaned.length === 0) {
    throw new Error("applyAssistantChat requires at least one message");
  }
  const client = getGemini();
  const models = getModelCandidates(model);
  console.log("applyAssistantChatGemini models", models);
  const promptText = buildChatPrompt(cleaned, summary);

  return withModelFallback(models, async (m) => {
    const genModel = client.getGenerativeModel({
      model: m,
      generationConfig: {
        temperature: 0.4,
        topP: 0.9,
        responseMimeType: "text/plain",
      },
    });

    const result = await genModel.generateContent(promptText);
    const text = result?.response?.text?.() || "";
    return text.trim();
  });
}

export async function applyAssistantEditGemini({
  prompt,
  summary,
  model,
} = {}) {
  if (!prompt || !prompt.trim()) {
    throw new Error("applyAssistantEdit requires a prompt");
  }
  const client = getGemini();
  const models = getModelCandidates(model);
  console.log("applyAssistantEditGemini models", models);
  const promptText = buildEditPrompt(summary, prompt);

  return withModelFallback(models, async (m) => {
    const genModel = client.getGenerativeModel({
      model: m,
      generationConfig: {
        temperature: 0.2,
        topP: 0.9,
        responseMimeType: "application/json",
      },
    });
    const result = await genModel.generateContent(promptText);
    const raw = result?.response?.text?.() || "{}";
    const parsed = parseJsonLoose(raw);
    return normalize(parsed);
  });
}
