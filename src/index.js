import "./config/env.js";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { config } from "./config/env.js";
import { logger } from "./config/logger.js";
import { swaggerSpec } from "./config/swagger.js";
import { globalLimiter } from "./middleware/rateLimiter.js";
import { errorHandler } from "./middleware/errorHandler.js";
import healthRouter from "./routes/health.js";
import generateRouter from "./routes/generate.js";

const app = express();

app.set("trust proxy", 1);

// Relax CSP only on the /api/docs route so Swagger UI assets load correctly.
// All other routes keep the strict helmet defaults.
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

// CORS — open to all origins.
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
  `,
  swaggerOptions: {
    // Persist "Try it out" state across page refreshes
    persistAuthorization: true,
    // Expand the first tag by default
    docExpansion: "list",
    // Show request duration in responses
    displayRequestDuration: true,
    // Show operation IDs
    displayOperationId: false,
    // Deep link to specific operations via URL hash
    deepLinking: true,
    // Show all models expanded in the schemas section
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
    // Syntax-highlight responses
    syntaxHighlight: { activate: true, theme: "monokai" },
    // Filter operations by tag/method
    filter: true,
    // Try-it-out enabled by default
    tryItOutEnabled: true,
  },
};

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// Raw OpenAPI JSON — useful for Postman, Insomnia, code generators, etc.
app.get("/api/docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*"); // allow Postman / tooling
  res.send(swaggerSpec);
});

// ── API routes ───────────────────────────────────────────────────────────────

app.use("/api/health", healthRouter);
app.use("/api/generate", generateRouter);

// 404 — unknown route
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Route '${req.method} ${req.path}' does not exist. Available endpoints: GET /api/health, POST /api/generate. Docs: GET /api/docs.`,
    },
  });
});

app.use(errorHandler);

// ── Start ────────────────────────────────────────────────────────────────────

app.listen(config.port, () => {
  logger.info(`Etech backend running on port ${config.port} [${config.nodeEnv}]`);
  logger.info(`Swagger UI → http://localhost:${config.port}/api/docs`);
  logger.info(`OpenAPI JSON → http://localhost:${config.port}/api/docs.json`);
});
