import crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config/env.js";
import { cacheGet, cacheSet } from "./aiCache.js";
import { logger } from "../config/logger.js";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

const MODEL = "claude-3-5-sonnet-20241022";

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

  const response = await client.messages.create({
    model: MODEL,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    temperature: 0.7,
    max_tokens: 2048,
  });
  const content = response.content[0].text;
  cacheSet(key, content);
  return content;
};
