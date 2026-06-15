import { logger } from "../config/logger.js";

export const errorHandler = (err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);

  if (err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      error: { code: "PAYLOAD_TOO_LARGE", message: "Request body exceeds size limit." },
    });
  }

  res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
  });
};
