import "./config/env.js";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import { config } from "./config/env.js";
import { logger } from "./config/logger.js";
import { globalLimiter } from "./middleware/rateLimiter.js";
import { errorHandler } from "./middleware/errorHandler.js";
import healthRouter from "./routes/health.js";
import generateRouter from "./routes/generate.js";

const app = express();

app.set("trust proxy", 1);

app.use(helmet());

app.use(
  cors({
    origin: config.allowedOrigin,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Accept"],
  })
);

app.use(globalLimiter);

app.use(express.json({ limit: "10kb" }));

app.use(
  morgan(config.nodeEnv === "production" ? "combined" : "dev", {
    stream: { write: (msg) => logger.info(msg.trim()) },
  })
);

app.use("/api/health", healthRouter);
app.use("/api/generate", generateRouter);

// 404 — unknown route
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Route '${req.method} ${req.path}' does not exist. Available endpoints: GET /api/health, POST /api/generate.`,
    },
  });
});

app.use(errorHandler);

app.listen(config.port, () => {
  logger.info(`Etech backend running on port ${config.port} [${config.nodeEnv}]`);
});
