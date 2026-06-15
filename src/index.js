import "./config/env.js";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { config } from "./config/env.js";
import { logger } from "./config/logger.js";
import { swaggerSpec } from "./config/swagger.js";
import { connectDB } from "./config/db.js";
import { globalLimiter } from "./middleware/rateLimiter.js";
import { errorHandler } from "./middleware/errorHandler.js";

import healthRouter from "./routes/health.js";
import generateRouter from "./routes/generate.js";
import authRouter from "./routes/auth.js";
import coursesRouter from "./routes/courses.js";
import sectionsRouter from "./routes/sections.js";
import progressRouter from "./routes/progress.js";
import subjectsRouter from "./routes/subjects.js";

const app = express();

app.set("trust proxy", 1);

// Relax CSP only on the /api/docs route so Swagger UI assets load correctly.
app.use(
  "/api/docs",
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https://validator.swagger.io"],
        connectSrc: ["'self'"],
      },
    },
  })
);
app.use(helmet());

// CORS — open to all origins
app.use(cors());

app.use(globalLimiter);
app.use(express.json({ limit: "10kb" }));

app.use(
  morgan(config.nodeEnv === "production" ? "combined" : "dev", {
    stream: { write: (msg) => logger.info(msg.trim()) },
  })
);

// ── Swagger UI ───────────────────────────────────────────────────────────────

const swaggerUiOptions = {
  customSiteTitle: "Etech API Docs",
  customCss: `
    .swagger-ui .topbar { background-color: #1a1a2e; }
    .swagger-ui .topbar-wrapper img { content: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 30"><text y="22" font-size="18" font-weight="bold" fill="%23fff" font-family="sans-serif">Etech API</text></svg>'); height: 28px; }
    .swagger-ui .info .title { color: #1a1a2e; }
    .swagger-ui .btn.execute { background-color: #4f46e5; border-color: #4f46e5; }
    .swagger-ui .btn.execute:hover { background-color: #3730a3; }
    .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #4f46e5; }
    .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #059669; }
    .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #dc2626; }
    .swagger-ui .opblock.opblock-patch .opblock-summary-method { background: #d97706; }
  `,
  swaggerOptions: {
    persistAuthorization: true,
    docExpansion: "list",
    displayRequestDuration: true,
    displayOperationId: false,
    deepLinking: true,
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
    syntaxHighlight: { activate: true, theme: "monokai" },
    filter: true,
    tryItOutEnabled: true,
  },
};

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

app.get("/api/docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.send(swaggerSpec);
});

// ── API Routes ───────────────────────────────────────────────────────────────

app.use("/api/health", healthRouter);
app.use("/api/generate", generateRouter);
app.use("/api/auth", authRouter);
app.use("/api/courses", coursesRouter);
app.use("/api/courses/:courseId/sections", sectionsRouter);
app.use("/api/courses/:courseId", progressRouter);
app.use("/api/subjects", subjectsRouter);

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Route '${req.method} ${req.path}' does not exist. Visit GET /api/docs for full API documentation.`,
    },
  });
});

app.use(errorHandler);

// ── Start ────────────────────────────────────────────────────────────────────

connectDB().then(() => {
  app.listen(config.port, () => {
    logger.info(`Etech LMS backend running on port ${config.port} [${config.nodeEnv}]`);
    logger.info(`Swagger UI  → http://localhost:${config.port}/api/docs`);
    logger.info(`OpenAPI JSON → http://localhost:${config.port}/api/docs.json`);
  });
});
