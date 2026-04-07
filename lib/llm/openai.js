import "dotenv/config";
import OpenAI from "openai";
import { buildPrompt, normalizeTemplate } from "./promptBuilder.js";
import { applySummaryFallback } from "./summaryFallback.js";
import {
  sanitizeActionItemText,
  sanitizeSummaryStrings,
} from "./summarySanitizer.js";

const OPENAI_MODELS = (process.env.OPENAI_MODELS || "")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
const DEFAULT_OPENAI_MODEL = OPENAI_MODELS[0] || "gpt-4o-mini";

let cachedOpenAI;
function getOpenAI() {
  if (cachedOpenAI) return cachedOpenAI;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing env: OPENAI_API_KEY");
  }
  cachedOpenAI = new OpenAI({ apiKey });
  return cachedOpenAI;
}

function getModelCandidates(explicitModel) {
  if (explicitModel) return [explicitModel];
  if (OPENAI_MODELS.length) return OPENAI_MODELS;
  return [DEFAULT_OPENAI_MODEL];
}

async function withModelFallback(models, runner) {
  let lastError;
  for (const model of models) {
    try {
      return await runner(model);
    } catch (err) {
      lastError = err;
      const status = err?.status ?? err?.statusCode ?? err?.response?.status;
      const code = err?.code || err?.error?.code;
      const isRateLimited =
        status === 429 || code === "rate_limit_exceeded" || code === "429";
      console.warn("OpenAI model failed", {
        model,
        status,
        code,
        isRateLimited,
        message: err?.message,
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
  return `You are an expert meeting notes editor. You will receive the current structured summary JSON and a user request. Update ONLY the fields needed to satisfy the request. Keep all other content as-is. Maintain the JSON shape exactly:
{
  "decisions": ["..."],
  "keyPoints": ["..."],
  "nextSteps": ["..."],
  "actionItems": [
    { "text": "...", "priority": "HIGH|MEDIUM|LOW", "assignee": "..." }
  ]
}

Rules:
- Return valid JSON only.
- Do not invent participants; if unsure, keep existing assignee or omit.
- Priorities must be HIGH, MEDIUM, or LOW (uppercase).
- Keep arrays; use empty arrays when nothing applies.
- If the request conflicts with structure, prefer keeping structure valid.

Current summary JSON:
${summaryJson}

User request:
${userPrompt}

Respond with ONLY the updated JSON.`;
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

export async function summarizeTranscriptOpenAI(
  transcript,
  { model, template } = {},
) {
  if (!transcript || !transcript.trim()) {
    throw new Error("summarizeTranscript requires transcript text");
  }
  const client = getOpenAI();
  const system = `You are an expert meeting summarizer. Produce crisp, bullet-ready text. Output strict JSON only.`;
  const safeTemplate = normalizeTemplate(template);
  const user = buildPrompt(transcript, safeTemplate);
  const models = getModelCandidates(model);
  console.log("summarizeTranscriptOpenAI calling", {
    models,
    transcriptPreview: transcript.slice(0, 120),
  });

  return withModelFallback(models, async (m) => {
    const response = await client.chat.completions.create({
      model: m,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const raw = response.choices?.[0]?.message?.content || "{}";
    console.log("summarizeTranscriptOpenAI raw", {
      model: m,
      preview: raw?.slice?.(0, 200),
    });
    const parsed = parseJsonLoose(raw);
    return applySummaryFallback(normalize(parsed), transcript);
  });
}

export async function formatTranscriptOpenAI(
  rawTranscript,
  readableTranscript,
  { model, template } = {},
) {
  if (!rawTranscript || !String(rawTranscript).trim()) {
    throw new Error("formatTranscript requires raw transcript text");
  }

  const client = getOpenAI();
  const models = getModelCandidates(model);
  const prompt = buildTranscriptFormattingPrompt(
    rawTranscript,
    readableTranscript,
    template,
  );

  return withModelFallback(models, async (m) => {
    const response = await client.chat.completions.create({
      model: m,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content:
            "You are a precise transcript formatter. Preserve meaning, do not summarize, and output plain text only.",
        },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices?.[0]?.message?.content || "";
    return content.trim();
  });
}

function buildChatMessages(messages, summary) {
  const system = {
    role: "system",
    content:
      "You are a helpful meeting copilot. Be concise. You can reference the structured summary JSON if needed. Do not invent names. If you don't know, say so.",
  };
  const summaryContext = {
    role: "system",
    content: `Current summary JSON:\n${JSON.stringify(
      normalizeSummary(summary),
      null,
      2,
    )}`,
  };
  const cleaned = normalizeChatMessages(messages);
  return [system, summaryContext, ...cleaned];
}

export async function applyAssistantChatOpenAI({
  messages,
  summary,
  model,
} = {}) {
  const chatMessages = buildChatMessages(messages, summary);
  if (chatMessages.length === 0) {
    throw new Error("applyAssistantChat requires at least one message");
  }
  const client = getOpenAI();
  const models = getModelCandidates(model);
  console.log("applyAssistantChatOpenAI calling", {
    models,
    messageCount: chatMessages.length,
  });

  return withModelFallback(models, async (m) => {
    const response = await client.chat.completions.create({
      model: m,
      temperature: 0.4,
      messages: chatMessages,
    });
    const content = response.choices?.[0]?.message?.content || "";
    console.log("applyAssistantChatOpenAI raw", {
      model: m,
      preview: content?.slice?.(0, 200),
    });
    return content.trim();
  });
}

export async function applyAssistantEditOpenAI({
  prompt,
  summary,
  model,
} = {}) {
  if (!prompt || !prompt.trim()) {
    throw new Error("applyAssistantEdit requires a prompt");
  }
  const client = getOpenAI();
  const system = `You edit structured meeting notes. Output strict JSON only, never prose.`;
  const user = buildEditPrompt(summary, prompt);
  const models = getModelCandidates(model);
  console.log("applyAssistantEditOpenAI calling", {
    models,
    promptPreview: prompt.slice(0, 120),
  });

  return withModelFallback(models, async (m) => {
    const response = await client.chat.completions.create({
      model: m,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const raw = response.choices?.[0]?.message?.content || "{}";
    console.log("applyAssistantEditOpenAI raw", {
      model: m,
      preview: raw?.slice?.(0, 200),
    });
    const parsed = parseJsonLoose(raw);
    return normalize(parsed);
  });
}
