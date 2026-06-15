import { logger } from "../config/logger.js";

const SUPPORT_HINT = "If the problem persists, please contact support.";

/**
 * Classify and respond to Groq / upstream AI API errors.
 * Groq SDK throws objects with { status, error: { message, type, code } }.
 */
const handleGroqError = (err, res) => {
  const status = err.status;
  const groqCode = err.error?.code;
  const groqType = err.error?.type;

  if (status === 400 || groqType === "invalid_request_error") {
    return res.status(422).json({
      success: false,
      error: {
        code: "AI_INVALID_REQUEST",
        message:
          "The request sent to the AI service was malformed. This is likely caused by an extremely unusual prompt. Please rephrase your input and try again.",
      },
    });
  }

  if (status === 401 || groqCode === "invalid_api_key") {
    return res.status(502).json({
      success: false,
      error: {
        code: "AI_AUTH_ERROR",
        message:
          "The server could not authenticate with the AI service. This is a configuration issue on our end — please contact support.",
      },
    });
  }

  if (status === 403) {
    return res.status(502).json({
      success: false,
      error: {
        code: "AI_FORBIDDEN",
        message:
          "Access to the AI service was denied. The API key may lack the required permissions. Please contact support.",
      },
    });
  }

  if (status === 404) {
    return res.status(502).json({
      success: false,
      error: {
        code: "AI_MODEL_NOT_FOUND",
        message:
          "The AI model requested could not be found. This is a server configuration issue — please contact support.",
      },
    });
  }

  if (status === 413) {
    return res.status(413).json({
      success: false,
      error: {
        code: "AI_CONTEXT_TOO_LONG",
        message:
          "Your prompt is too long for the AI model to process. Please shorten your prompt (maximum ~500 characters) and try again.",
      },
    });
  }

  if (status === 422) {
    return res.status(422).json({
      success: false,
      error: {
        code: "AI_UNPROCESSABLE",
        message:
          "The AI service could not process this request. Your prompt may contain unsupported content. Please rephrase and try again.",
      },
    });
  }

  if (status === 429 || groqCode === "rate_limit_exceeded") {
    return res.status(503).json({
      success: false,
      error: {
        code: "AI_RATE_LIMITED",
        message:
          "The AI service has temporarily rate-limited this server. Please wait 10–30 seconds and try again.",
        retryAfterSeconds: 30,
      },
    });
  }

  if (status === 500) {
    return res.status(502).json({
      success: false,
      error: {
        code: "AI_INTERNAL_ERROR",
        message:
          "The AI service encountered an internal error while processing your request. Please try again in a few seconds.",
      },
    });
  }

  if (status === 503) {
    return res.status(503).json({
      success: false,
      error: {
        code: "AI_SERVICE_UNAVAILABLE",
        message:
          "The AI service is temporarily unavailable (possibly under maintenance). Please try again in a few minutes.",
        retryAfterSeconds: 60,
      },
    });
  }

  if (status === 504) {
    return res.status(504).json({
      success: false,
      error: {
        code: "AI_TIMEOUT",
        message:
          "The AI service took too long to respond. This can happen with complex prompts. Please try again or simplify your prompt.",
      },
    });
  }

  // Unknown Groq error
  return res.status(502).json({
    success: false,
    error: {
      code: "AI_SERVICE_ERROR",
      message: `The AI service returned an unexpected error (HTTP ${status}). Please try again. ${SUPPORT_HINT}`,
    },
  });
};

export const errorHandler = (err, req, res, next) => {
  logger.error(
    `[${req.method} ${req.path}] ${err.status || err.statusCode || 500} — ${err.message}`
  );

  // ── Express / HTTP body parsing errors ─────────────────────────────────

  if (err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message:
          "Request body exceeds the 10kb size limit. Please shorten your prompt or topic and try again.",
      },
    });
  }

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_JSON",
        message:
          "Request body contains invalid JSON. Ensure the body is well-formed JSON with double-quoted keys and values.",
      },
    });
  }

  if (err.type === "charset.unsupported") {
    return res.status(415).json({
      success: false,
      error: {
        code: "UNSUPPORTED_CHARSET",
        message:
          "The request body uses an unsupported character set. Please send your request with UTF-8 encoding.",
      },
    });
  }

  // ── CORS errors ─────────────────────────────────────────────────────────

  if (err.message?.toLowerCase().includes("not allowed by cors")) {
    return res.status(403).json({
      success: false,
      error: {
        code: "CORS_BLOCKED",
        message:
          "This request was blocked by CORS policy. Only requests from the authorised frontend origin are accepted.",
      },
    });
  }

  // ── HTTP method / route errors ──────────────────────────────────────────

  if (err.status === 405 || err.statusCode === 405) {
    return res.status(405).json({
      success: false,
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: `HTTP method '${req.method}' is not supported on '${req.path}'. Supported methods: GET /api/health, POST /api/generate.`,
      },
    });
  }

  // ── Groq SDK / upstream AI errors ──────────────────────────────────────

  if (err.status && err.error !== undefined) {
    return handleGroqError(err, res);
  }

  // Network / connection errors reaching Groq
  if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
    return res.status(502).json({
      success: false,
      error: {
        code: "AI_UNREACHABLE",
        message:
          "The server could not reach the AI service. This may be a temporary network issue. Please try again in a few seconds.",
      },
    });
  }

  if (err.code === "ETIMEDOUT" || err.code === "ESOCKETTIMEDOUT") {
    return res.status(504).json({
      success: false,
      error: {
        code: "AI_TIMEOUT",
        message:
          "The connection to the AI service timed out. This can happen with complex prompts. Please try again or simplify your prompt.",
      },
    });
  }

  if (err.code === "ECONNRESET") {
    return res.status(502).json({
      success: false,
      error: {
        code: "CONNECTION_RESET",
        message:
          "The connection to the AI service was unexpectedly closed. Please try again.",
      },
    });
  }

  // ── JSON / syntax errors in server code ────────────────────────────────

  if (err instanceof SyntaxError) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_JSON",
        message:
          "The server received malformed JSON. Please check your request body and try again.",
      },
    });
  }

  // ── Generic / unknown fallback ──────────────────────────────────────────

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: `An unexpected server error occurred. Please try again. ${SUPPORT_HINT}`,
    },
  });
};
