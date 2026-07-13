import rateLimit from "express-rate-limit";

const makeHandler = (limit, windowMinutes) => (req, res) => {
  const retryAfter = Math.ceil(res.getHeader("Retry-After") || windowMinutes * 60);
  res.status(429).json({
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: `You have exceeded the allowed ${limit} requests per ${windowMinutes} minutes from this IP address. Please wait ${retryAfter} seconds before trying again.`,
      retryAfterSeconds: retryAfter,
    },
  });
};

// AI generation endpoints — 20 req / 15 min
export const generateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler(20, 15),
});

// All routes — 100 req / 15 min
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler(100, 15),
});

// Sensitive actions: password change, account deletion, quiz submission — 5 req / 15 min
export const sensitiveActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler(5, 15),
});
