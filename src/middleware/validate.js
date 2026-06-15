import { z } from "zod";

const stripHtml = (str) => str.replace(/<[^>]*>/g, "").replace(/[<>]/g, "");

const VALID_FORMATS = ["text", "audio", "image", "interactive", "video"];
const VALID_LEVELS = ["Beginner", "Intermediate", "Advanced"];

const schema = z.object({
  format: z.enum(VALID_FORMATS, {
    required_error: "Field 'format' is required.",
    invalid_type_error: `Field 'format' must be a string. Accepted values: ${VALID_FORMATS.join(", ")}.`,
  }).refine((v) => VALID_FORMATS.includes(v), {
    message: `Field 'format' must be one of: ${VALID_FORMATS.join(", ")}.`,
  }),

  prompt: z
    .string({
      required_error: "Field 'prompt' is required.",
      invalid_type_error: "Field 'prompt' must be a string.",
    })
    .min(5, "Field 'prompt' is too short — minimum 5 characters.")
    .max(500, "Field 'prompt' is too long — maximum 500 characters.")
    .transform(stripHtml),

  topic: z
    .string({
      required_error: "Field 'topic' is required.",
      invalid_type_error: "Field 'topic' must be a string.",
    })
    .min(2, "Field 'topic' is too short — minimum 2 characters.")
    .max(100, "Field 'topic' is too long — maximum 100 characters.")
    .transform(stripHtml),

  level: z.enum(VALID_LEVELS, {
    required_error: "Field 'level' is required.",
    invalid_type_error: `Field 'level' must be a string. Accepted values: ${VALID_LEVELS.join(", ")}.`,
  }).refine((v) => VALID_LEVELS.includes(v), {
    message: `Field 'level' must be one of: ${VALID_LEVELS.join(", ")}.`,
  }),
});

export const validateGenerate = (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const fields = result.error.errors.map((e) => ({
      field: e.path.join(".") || "unknown",
      message: e.message,
    }));

    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: `Request validation failed. ${fields.length} issue${fields.length > 1 ? "s" : ""} found.`,
        fields,
      },
    });
  }

  req.body = result.data;
  next();
};
