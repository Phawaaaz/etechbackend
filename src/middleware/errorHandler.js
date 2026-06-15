import { logger } from "../config/logger.js";

export const errorHandler = (err, req, res, next) => {
  logger.error(`Unhandled error on ${req.method} ${req.path}: ${err.message}`);

  // Payload too large (express.json limit)
  if (err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request body exceeds the 10kb size limit. Please reduce the size of your input and try again.",
      },
    });
  }

  // Malformed JSON body
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "Request body contains invalid JSON. Please check your request format and try again.",
      },
    });
  }

  // Groq API errors
  if (err.status && err.error) {
    const status = err.status;

    if (status === 401) {
      return res.status(502).json({
        success: false,
        error: {
          code: "AI_AUTH_ERROR",
          message: "The AI service could not authenticate. This is a server configuration issue — please contact support.",
        },
      });
    }

    if (status === 429) {
      return res.status(503).json({
        success: false,
        error: {
          code: "AI_RATE_LIMITED",
          message: "The AI service is temporarily rate-limited. Please wait a moment and try again.",
        },
      });
    }

    if (status >= 500) {
      return res.status(502).json({
        success: false,
        error: {
          code: "AI_SERVICE_ERROR",
          message: "The AI service is currently unavailable. Please try again in a few seconds.",
        },
      });
    }
  }

  // Method not allowed
  if (err.status === 405) {
    return res.status(405).json({
      success: false,
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: `HTTP method '${req.method}' is not allowed on this endpoint. Check the API documentation for supported methods.`,
      },
    });
  }

  // Fallback
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected server error occurred. Please try again. If the problem persists, contact support.",
    },
  });
};
