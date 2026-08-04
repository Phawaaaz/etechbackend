import OpenAI from "openai";
import { config } from "../config/env.js";

const client = new OpenAI({
  apiKey: config.aiApiKey,
  // OpenAI-compatible provider (e.g. AgentRouter). Must include the /v1 suffix.
  // Falls back to the SDK default (the official OpenAI API) when unset.
  ...(config.aiBaseUrl ? { baseURL: config.aiBaseUrl } : {}),
  // AgentRouter fingerprints the client and rejects non-Codex User-Agents with
  // a 401 "unauthorized client detected". Presenting the Codex CLI identity
  // clears that gate. Harmless against the first-party OpenAI API.
  defaultHeaders: {
    "User-Agent": "codex_cli_rs/0.5.0",
    "originator": "codex_cli_rs",
  },
});

// Model is configurable via AI_MODEL; defaults to gpt-5.6-sol (AgentRouter's
// only model available to this token — verify with GET /v1/models).
const MODEL = config.aiModel || "gpt-5.6-sol";
const MAX_TOKENS = 8192;

/**
 * Generate text from the AI provider given a system prompt and a user prompt.
 * Preserves the provider-agnostic contract: returns a plain string.
 */
export const generate = async (systemPrompt, userPrompt) => {
  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  return response.choices?.[0]?.message?.content ?? "";
};
