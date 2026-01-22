import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildPrompt, normalizeTemplate } from "./promptBuilder.js";

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
  } catch (_) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
  }
  return {};
}

export async function summarizeTranscriptGemini(
  transcript,
  { model, template } = {}
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
    return normalize(parsed);
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
