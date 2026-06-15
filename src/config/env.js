import dotenv from "dotenv";
dotenv.config();

// ── Environment variable definitions ─────────────────────────────────────────
// Each entry defines whether the variable is required, its default value,
// a validator function, and a human-readable description + fix hint.

const ENV_SPEC = [
  {
    key: "GROQ_API_KEY",
    required: true,
    description: "Groq API key used to authenticate with the AI service.",
    hint: "Get your key at https://console.groq.com → API Keys → Create API Key. Add it to your .env file as: GROQ_API_KEY=gsk_...",
    validate: (v) => v.startsWith("gsk_") || "Value does not look like a valid Groq API key (expected prefix: gsk_).",
  },
  {
    key: "ALLOWED_ORIGIN",
    required: false,
    default: "*",
    description: "Optional: restrict CORS to a specific frontend origin. Defaults to open (*) if not set.",
    hint: 'Set to your frontend URL, e.g. ALLOWED_ORIGIN=https://yourdomain.com to restrict access in production.',
    validate: (v) => {
      if (v === "*") return true;
      try {
        new URL(v);
        return true;
      } catch {
        return "Value must be a valid URL (e.g. http://localhost:5173 or https://yourdomain.com) or omitted entirely.";
      }
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
      return (Number.isInteger(n) && n >= 1024 && n <= 65535)
        || "PORT must be an integer between 1024 and 65535.";
    },
  },
  {
    key: "NODE_ENV",
    required: false,
    default: "development",
    description: "Runtime environment. Controls logging behaviour and other env-specific settings.",
    hint: 'Set to "production" in deployed environments and "development" locally.',
    validate: (v) =>
      ["development", "production", "test"].includes(v)
        || 'NODE_ENV must be one of: development, production, test.',
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
  groqApiKey: process.env.GROQ_API_KEY,
  allowedOrigin: process.env.ALLOWED_ORIGIN,
};
