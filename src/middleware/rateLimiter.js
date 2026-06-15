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

export const generateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler(20, 15),
});

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler(100, 15),
});
