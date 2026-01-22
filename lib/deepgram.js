import "dotenv/config";
import { createClient } from "@deepgram/sdk";

let cachedClient;

function getDeepgramClient() {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) throw new Error("Missing required env var: DEEPGRAM_API_KEY");
  cachedClient = createClient(apiKey);
  return cachedClient;
}

/**
 * Transcribes an audio URL using Deepgram.
 * @param {string} audioUrl - A publicly accessible (or signed) URL to the audio file.
 * @param {import("@deepgram/sdk").PrerecordedOptions} [options]
 */
export async function transcribeFromUrl(audioUrl, options = {}) {
  if (!audioUrl) throw new Error("transcribeFromUrl requires an audioUrl");

  const baseOptions = {
    model: "nova-3",
    language: "en",
    smart_format: true,
  };

  const deepgram = getDeepgramClient();

  try {
    console.log("start transcribeFromUrl:", audioUrl);
    const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
      { url: audioUrl },
      { ...baseOptions, ...options }
    );

    console.log("transcribeFromUrl result:", result);

    if (error) {
      console.error("Deepgram error", error);
      throw new Error(error.message || "Deepgram transcription failed");
    }

    return result;
  } catch (err) {
    console.error("Transcription failed", err);
    const wrapped =
      err instanceof Error ? err : new Error("Transcription failed");
    wrapped.statusCode = wrapped.statusCode || 502;
    throw wrapped;
  }
}
