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

// AI generation endpoints — 60 req / 15 min. Raised from 20 because repeated
// prompts are now served from the AI response cache without spending Groq quota.
export const generateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler(60, 15),
});

// All routes — 500 req / 15 min. Generous because many users can share one
// public IP (campus Wi-Fi / NAT) and this counts every API call they make.
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler(500, 15),
});

// Sensitive actions: password change, account deletion, quiz submission — 5 req / 15 min
export const sensitiveActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler(15, 15),
});
