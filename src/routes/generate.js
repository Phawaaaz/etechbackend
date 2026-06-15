import { Router } from "express";
import { randomUUID } from "crypto";
import { validateGenerate } from "../middleware/validate.js";
import { generateLimiter } from "../middleware/rateLimiter.js";
import { buildPrompts } from "../services/promptBuilder.js";
import { generate } from "../services/groqService.js";
import { generateImageUrl } from "../services/imageService.js";
import { logger } from "../config/logger.js";

const router = Router();

const SUSPICIOUS_PATTERNS = [
  /ignore previous/i,
  /ignore all previous/i,
  /system prompt/i,
  /jailbreak/i,
  /disregard (your|all) instructions/i,
  /you are now/i,
  /act as/i,
  /pretend (you are|to be)/i,
];

const containsSuspiciousContent = (text) =>
  SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(text));

const parseJsonWithRetry = async (systemPrompt, userPrompt) => {
  const attempt = async () => {
    const raw = await generate(systemPrompt, userPrompt);
    return JSON.parse(raw);
  };

  try {
    return await attempt();
  } catch {
    logger.warn("JSON parse failed on first attempt, retrying...");
    return await attempt();
  }
};

router.post("/", generateLimiter, validateGenerate, async (req, res, next) => {
  const { format, prompt, topic, level } = req.body;

  try {
    const { systemPrompt, userPrompt } = buildPrompts(format, prompt, topic, level);
    let content;

    if (format === "interactive" || format === "video") {
      try {
        content = await parseJsonWithRetry(systemPrompt, userPrompt);
      } catch (err) {
        logger.error(`JSON generation failed for format ${format}: ${err.message}`);
        return res.status(500).json({
          success: false,
          error: { code: "GENERATION_ERROR", message: "Failed to generate valid content. Please try again." },
        });
      }
    } else if (format === "image") {
      const imagePrompt = await generate(systemPrompt, userPrompt);
      content = generateImageUrl(imagePrompt);
    } else {
      const raw = await generate(systemPrompt, userPrompt);

      if (containsSuspiciousContent(raw)) {
        logger.warn("Suspicious content detected in AI response, discarding.");
        return res.status(500).json({
          success: false,
          error: { code: "GENERATION_ERROR", message: "Content could not be generated. Please try again." },
        });
      }

      content = raw;
    }

    res.json({
      success: true,
      data: {
        id: `gen_${randomUUID()}`,
        format,
        content,
        topic,
        level,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
