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

const parseJsonWithRetry = async (systemPrompt, userPrompt, format) => {
  const attempt = async (attemptNumber) => {
    const raw = await generate(systemPrompt, userPrompt);
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error(
        `AI returned malformed JSON on attempt ${attemptNumber}. The model may be having trouble with this request — please try rephrasing your prompt.`
      );
    }
  };

  try {
    return await attempt(1);
  } catch (firstErr) {
    logger.warn(`JSON parse failed (attempt 1) for format '${format}': ${firstErr.message}. Retrying...`);
    return await attempt(2);
  }
};

router.post("/", generateLimiter, validateGenerate, async (req, res, next) => {
  const { format, prompt, topic, level } = req.body;

  try {
    const { systemPrompt, userPrompt } = buildPrompts(format, prompt, topic, level);
    let content;

    if (format === "interactive" || format === "video") {
      try {
        content = await parseJsonWithRetry(systemPrompt, userPrompt, format);
      } catch (err) {
        logger.error(`JSON generation failed after 2 attempts for format '${format}': ${err.message}`);
        return res.status(500).json({
          success: false,
          error: {
            code: "GENERATION_ERROR",
            message: `Failed to generate valid ${format === "interactive" ? "quiz questions" : "video storyboard"} after 2 attempts. The AI model returned an unexpected response. Please try rephrasing your prompt or try again shortly.`,
          },
        });
      }
    } else if (format === "image") {
      const imagePrompt = await generate(systemPrompt, userPrompt);
      content = generateImageUrl(imagePrompt);
    } else {
      const raw = await generate(systemPrompt, userPrompt);

      if (containsSuspiciousContent(raw)) {
        logger.warn(`Suspicious content detected in AI response for format '${format}'. Discarding.`);
        return res.status(500).json({
          success: false,
          error: {
            code: "GENERATION_ERROR",
            message: "The AI response was flagged as potentially unsafe and has been discarded. Please rephrase your prompt and try again.",
          },
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
