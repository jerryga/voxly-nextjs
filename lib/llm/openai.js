import "dotenv/config";
import OpenAI from "openai";
import { buildPrompt, normalizeTemplate } from "./promptBuilder.js";

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
    decisions: Array.isArray(parsed?.decisions) ? parsed.decisions : [],
    keyPoints: Array.isArray(parsed?.keyPoints) ? parsed.keyPoints : [],
    nextSteps: Array.isArray(parsed?.nextSteps) ? parsed.nextSteps : [],
    actionItems: Array.isArray(parsed?.actionItems) ? parsed.actionItems : [],
  };
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
  } catch (_) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
  }
  return {};
}

export async function summarizeTranscriptOpenAI(
  transcript,
  { model, template } = {}
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
    return normalize(parsed);
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
      2
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
