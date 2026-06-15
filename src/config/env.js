import dotenv from "dotenv";
dotenv.config();

const required = ["GROQ_API_KEY", "ALLOWED_ORIGIN"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`[startup] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  groqApiKey: process.env.GROQ_API_KEY,
  allowedOrigin: process.env.ALLOWED_ORIGIN,
};
