import crypto from "node:crypto";
import Groq from "groq-sdk";
import { config } from "../config/env.js";
import { cacheGet, cacheSet } from "./aiCache.js";
import { logger } from "../config/logger.js";

const client = new Groq({ apiKey: config.groqApiKey });

const MODEL = "llama-3.3-70b-versatile";

// skipCacheRead: used by JSON-retry paths so a cached malformed response
// can't be returned again; the fresh result still overwrites the cache.
export const generate = async (systemPrompt, userPrompt, { skipCacheRead = false } = {}) => {
  const key = crypto
    .createHash("sha256")
    .update(`${MODEL}\0${systemPrompt}\0${userPrompt}`)
    .digest("hex");

  if (!skipCacheRead) {
    const cached = cacheGet(key);
    if (cached !== undefined) {
      logger.debug(`AI cache hit (${key.slice(0, 8)})`);
      return cached;
    }
  }

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 2048,
  });
  const content = response.choices[0].message.content;
  cacheSet(key, content);
  return content;
};
