import dotenv from "dotenv";
dotenv.config();



const ENV_SPEC = [
  {
    key: "OPENAI_API_KEY",
    required: true,
    description: "API key used to authenticate with the OpenAI-compatible AI service.",
    hint: "Get your AgentRouter key at https://agentrouter.org/console/token (starts with 'ak-'). First-party OpenAI keys start with 'sk-'. Add it as: OPENAI_API_KEY=ak-...",
    validate: (v) =>
      v.startsWith("ak-") || v.startsWith("sk-") ||
      "Value does not look like a valid API key (expected prefix: ak- for AgentRouter or sk- for OpenAI).",
  },
  {
    key: "OPENAI_BASE_URL",
    required: false,
    description: "Optional: override the API base URL to use an OpenAI-compatible proxy instead of the first-party API.",
    hint: "Leave unset to use the default OpenAI API. For AgentRouter set: OPENAI_BASE_URL=https://agentrouter.org/v1 (the /v1 suffix is required).",
    validate: (v) => {
      try { new URL(v); return true; } catch { return "Value must be a valid URL (e.g. https://agentrouter.org/v1)."; }
    },
  },
  {
    key: "OPENAI_MODEL",
    required: false,
    default: "gpt-5.6-sol",
    description: "The model id to use for generation.",
    hint: "Defaults to gpt-5.6-sol. Check which models your token can access with GET /v1/models.",
    validate: () => true,
  },
  {
    key: "MONGODB_URI",
    required: true,
    description: "MongoDB connection string used to connect to the database.",
    hint: "Create a free cluster at https://cloud.mongodb.com → Connect → Drivers → copy the connection string. Add it as: MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/etech",
    validate: (v) =>
      (v.startsWith("mongodb://") || v.startsWith("mongodb+srv://")) ||
      "Value must start with 'mongodb://' or 'mongodb+srv://'.",
  },
  {
    key: "JWT_SECRET",
    required: true,
    description: "Secret key used to sign access tokens.",
    hint: "Generate a strong random string: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"",
    validate: (v) => v.length >= 32 || "JWT_SECRET must be at least 32 characters long.",
  },
  {
    key: "JWT_REFRESH_SECRET",
    required: true,
    description: "Secret key used to sign refresh tokens. Must be different from JWT_SECRET.",
    hint: "Generate a different strong random string: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"",
    validate: (v) => v.length >= 32 || "JWT_REFRESH_SECRET must be at least 32 characters long.",
  },
  {
    key: "ALLOWED_ORIGIN",
    required: false,
    default: "*",
    description: "Optional: restrict CORS to a specific frontend origin. Defaults to open (*) if not set.",
    hint: "Set to your frontend URL, e.g. ALLOWED_ORIGIN=https://yourdomain.com to restrict access in production.",
    validate: (v) => {
      if (v === "*") return true;
      try { new URL(v); return true; } catch { return "Value must be a valid URL or omitted entirely."; }
    },
  },
  {
    key: "PORT",
    required: false,
    default: "5000",
    description: "Port the Express server will listen on.",
    hint: "Defaults to 5000 if not set. Must be a number between 1024 and 65535.",
    validate: (v) => {
      const n = Number(v);
      return (Number.isInteger(n) && n >= 1024 && n <= 65535) || "PORT must be an integer between 1024 and 65535.";
    },
  },
  {
    key: "NODE_ENV",
    required: false,
    default: "development",
    description: "Runtime environment. Controls logging behaviour and other env-specific settings.",
    hint: 'Set to "production" in deployed environments and "development" locally.',
    validate: (v) => ["development", "production", "test"].includes(v) || 'NODE_ENV must be one of: development, production, test.',
  },
  {
    key: "JWT_EXPIRES_IN",
    required: false,
    default: "15m",
    description: "Access token expiry duration.",
    hint: "Examples: 15m, 1h, 1d. Keep short for security.",
    validate: () => true,
  },
  {
    key: "JWT_REFRESH_EXPIRES_IN",
    required: false,
    default: "7d",
    description: "Refresh token expiry duration.",
    hint: "Examples: 7d, 30d.",
    validate: () => true,
  },
];

// ── Validate all variables at startup ────────────────────────────────────────

let hasErrors = false;

for (const spec of ENV_SPEC) {
  const raw = process.env[spec.key];
  const value = raw ?? spec.default;

  if (spec.required && !raw) {
    console.error(`\n[env] MISSING required variable: ${spec.key}`);
    console.error(`      What it does: ${spec.description}`);
    console.error(`      How to fix:   ${spec.hint}\n`);
    hasErrors = true;
    continue;
  }

  if (value) {
    const result = spec.validate(value);
    if (result !== true) {
      console.error(`\n[env] INVALID value for ${spec.key}="${value}"`);
      console.error(`      Problem:    ${result}`);
      console.error(`      What it does: ${spec.description}`);
      console.error(`      How to fix:   ${spec.hint}\n`);
      hasErrors = true;
    }
  }
}

if (hasErrors) {
  console.error("[env] Server startup aborted due to environment configuration errors above.");
  console.error("[env] Copy .env.example to .env and fill in the correct values.\n");
  process.exit(1);
}

// ── Export validated config ───────────────────────────────────────────────────

export const config = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  aiApiKey: process.env.OPENAI_API_KEY,
  aiBaseUrl: process.env.OPENAI_BASE_URL,
  aiModel: process.env.OPENAI_MODEL || "gpt-5.6-sol",
  allowedOrigin: process.env.ALLOWED_ORIGIN,
};
