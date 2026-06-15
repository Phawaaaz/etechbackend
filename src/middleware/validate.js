import { z } from "zod";

const stripHtml = (str) => str.replace(/<[^>]*>/g, "").replace(/[<>]/g, "");

const schema = z.object({
  format: z.enum(["text", "audio", "image", "interactive", "video"]),
  prompt: z
    .string()
    .min(5, "Prompt must be at least 5 characters")
    .max(500, "Prompt must be at most 500 characters")
    .transform(stripHtml),
  topic: z
    .string()
    .min(2, "Topic must be at least 2 characters")
    .max(100, "Topic must be at most 100 characters")
    .transform(stripHtml),
  level: z.enum(["Beginner", "Intermediate", "Advanced"]),
});

export const validateGenerate = (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const message = result.error.errors.map((e) => e.message).join("; ");
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message },
    });
  }
  req.body = result.data;
  next();
};
