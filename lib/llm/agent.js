import "dotenv/config";
import {
  summarizeTranscriptOpenAI,
  applyAssistantEditOpenAI,
  applyAssistantChatOpenAI,
} from "./openai.js";
import {
  summarizeTranscriptGemini,
  applyAssistantEditGemini,
  applyAssistantChatGemini,
} from "./gemini.js";

const DEFAULT_PROVIDER = (process.env.LLM_PROVIDER || "openai").toLowerCase();

function getProviderOrder(preferred) {
  if (preferred === "openai-only") return ["openai"];
  if (preferred === "gemini-only") return ["gemini"];
  const base =
    preferred === "openai" ? ["gemini", "openai"] : ["gemini", "openai"];
  return base;
}

async function runWithProviders(order, runner) {
  let lastError;
  for (const provider of order) {
    try {
      return await runner(provider);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

/**
 * Agent wrapper to switch providers (openai|gemini) via param or env LLM_PROVIDER.
 */
export async function summarizeTranscript(
  transcript,
  { provider, model, template } = {}
) {
  const order = getProviderOrder(
    (provider || DEFAULT_PROVIDER || "openai").toLowerCase()
  );
  return runWithProviders(order, async (prov) => {
    if (prov === "gemini")
      return summarizeTranscriptGemini(transcript, { model, template });
    if (prov === "openai")
      return summarizeTranscriptOpenAI(transcript, { model, template });
    throw new Error(`Unsupported provider ${prov}`);
  });
}

/**
 * Edit an existing structured summary using a provider (openai|gemini).
 */
export async function applyAssistantEdit({
  prompt,
  summary,
  provider,
  model,
} = {}) {
  const order = getProviderOrder(
    (provider || DEFAULT_PROVIDER || "openai").toLowerCase()
  );
  return runWithProviders(order, async (prov) => {
    if (prov === "gemini")
      return applyAssistantEditGemini({ prompt, summary, model });
    if (prov === "openai")
      return applyAssistantEditOpenAI({ prompt, summary, model });
    throw new Error(`Unsupported provider ${prov}`);
  });
}

/**
 * Chat with the assistant using structured context.
 */
export async function applyAssistantChat({
  messages,
  summary,
  provider,
  model,
} = {}) {
  const order = getProviderOrder(
    (provider || DEFAULT_PROVIDER || "openai").toLowerCase()
  );
  return runWithProviders(order, async (prov) => {
    if (prov === "gemini")
      return applyAssistantChatGemini({ messages, summary, model });
    if (prov === "openai")
      return applyAssistantChatOpenAI({ messages, summary, model });
    throw new Error(`Unsupported provider ${prov}`);
  });
}
