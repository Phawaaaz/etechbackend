import swaggerJsdoc from "swagger-jsdoc";
import { config } from "./env.js";

const servers =
  config.nodeEnv === "production"
    ? [{ url: config.allowedOrigin.replace(/\/$/, ""), description: "Production server" }]
    : [
        { url: `http://localhost:${config.port}`, description: "Local development server" },
        { url: config.allowedOrigin.replace(/\/$/, ""), description: "Configured origin" },
      ];

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Etech API",
      version: "1.0.0",
      description: `
## Etech — AI Educational Content Generation API

Generate educational content in five formats using **Groq** (\`llama-3.3-70b-versatile\`) and **Pollinations.ai**.

### Formats
| Format | What you get | Rendered by |
|---|---|---|
| \`text\` | Markdown explanation | Frontend markdown renderer |
| \`audio\` | Spoken plain-text script | \`window.speechSynthesis\` |
| \`image\` | Pollinations.ai image URL | \`<img src={content} />\` |
| \`interactive\` | 5-question quiz (JSON array) | Frontend quiz component |
| \`video\` | 5-scene storyboard (JSON array) | Frontend video builder |

### Rate limits
- \`POST /api/generate\` → **60 requests / IP / 15 min** (repeated prompts served from cache)
- All other routes → **500 requests / IP / 15 min**

### Response envelope
Every response follows this shape:
\`\`\`json
{ "success": true|false, "data": {...} | "error": { "code": "...", "message": "..." } }
\`\`\`
      `.trim(),
      contact: {
        name: "Etech Support",
        email: "phawaazakinola@gmail.com",
      },
      license: {
        name: "MIT",
      },
    },
    servers,
    tags: [
      {
        name: "Health",
        description: "Server liveness check. No authentication required.",
      },
      {
        name: "Generate",
        description:
          "AI content generation. All requests are rate-limited and validated.",
      },
    ],
    components: {
      schemas: {
        // ── Request ───────────────────────────────────────────────────────
        GenerateRequest: {
          type: "object",
          required: ["format", "prompt", "topic", "level"],
          properties: {
            format: {
              type: "string",
              enum: ["text", "audio", "image", "interactive", "video"],
              description:
                "Content format to generate. Determines what the AI produces and how `content` is shaped in the response.",
              example: "text",
            },
            prompt: {
              type: "string",
              minLength: 5,
              maxLength: 500,
              description:
                "The educational task or question. HTML tags are stripped automatically. Keep under 500 chars.",
              example: "Explain quantum computing",
            },
            topic: {
              type: "string",
              minLength: 2,
              maxLength: 100,
              description:
                "Subject area. Used to focus the AI's response. HTML tags are stripped automatically.",
              example: "Quantum Physics",
            },
            level: {
              type: "string",
              enum: ["Beginner", "Intermediate", "Advanced"],
              description:
                "Target audience difficulty level. The AI tailors vocabulary and depth accordingly.",
              example: "Beginner",
            },
          },
        },

        // ── Shared sub-schemas ────────────────────────────────────────────
        QuizQuestion: {
          type: "object",
          description: "A single multiple-choice quiz question.",
          properties: {
            question: { type: "string", example: "What is a qubit?" },
            options: {
              type: "array",
              items: { type: "string" },
              minItems: 4,
              maxItems: 4,
              example: [
                "A classical bit",
                "A quantum bit",
                "A binary unit",
                "A logic gate",
              ],
            },
            answer: {
              type: "string",
              description: "The correct option string (matches one of the options).",
              example: "A quantum bit",
            },
            explanation: {
              type: "string",
              description: "Why the answer is correct. Show to the user after they answer.",
              example:
                "A qubit is the basic unit of quantum information — unlike a classical bit it can exist in superposition.",
            },
          },
        },

        VideoScene: {
          type: "object",
          description: "A single scene in a 5-scene educational video storyboard.",
          properties: {
            scene: { type: "integer", example: 1 },
            title: {
              type: "string",
              example: "Introduction to Quantum Computing",
            },
            narration: {
              type: "string",
              description: "Spoken narration text for this scene.",
              example:
                "Welcome to the world of quantum computing, where the rules of classical physics no longer apply...",
            },
            visual_description: {
              type: "string",
              description: "Description of the visual/animation shown during this scene.",
              example:
                "Animation of a glowing qubit spinning in superposition against a dark background.",
            },
          },
        },

        // ── Success response wrappers ─────────────────────────────────────
        GenerateResponseText: {
          type: "object",
          description:
            "Returned for `text` (markdown explanation) and `audio` (spoken script) formats. Also returned for `image` — `content` is a Pollinations.ai URL.",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  description: "Unique generation ID.",
                  example: "gen_3f2a1b4c-9d8e-4a2b-b1c3-123456789abc",
                },
                format: {
                  type: "string",
                  enum: ["text", "audio", "image"],
                  example: "text",
                },
                content: {
                  type: "string",
                  description:
                    "For `text`: markdown string. For `audio`: plain spoken script. For `image`: Pollinations.ai image URL.",
                  example: "## Quantum Computing\n\nQuantum computing harnesses the principles of...",
                },
                topic: { type: "string", example: "Quantum Physics" },
                level: { type: "string", example: "Beginner" },
                createdAt: {
                  type: "string",
                  format: "date-time",
                  example: "2026-06-15T08:00:00.000Z",
                },
              },
            },
          },
        },

        GenerateResponseInteractive: {
          type: "object",
          description: "Returned for `interactive` format. `content` is a parsed JSON array of 5 quiz questions.",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                id: { type: "string", example: "gen_3f2a1b4c-..." },
                format: { type: "string", enum: ["interactive"], example: "interactive" },
                content: {
                  type: "array",
                  items: { $ref: "#/components/schemas/QuizQuestion" },
                  minItems: 5,
                  maxItems: 5,
                },
                topic: { type: "string", example: "Quantum Physics" },
                level: { type: "string", example: "Beginner" },
                createdAt: { type: "string", format: "date-time" },
              },
            },
          },
        },

        GenerateResponseVideo: {
          type: "object",
          description: "Returned for `video` format. `content` is a parsed JSON array of 5 storyboard scenes.",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                id: { type: "string", example: "gen_3f2a1b4c-..." },
                format: { type: "string", enum: ["video"], example: "video" },
                content: {
                  type: "array",
                  items: { $ref: "#/components/schemas/VideoScene" },
                  minItems: 5,
                  maxItems: 5,
                },
                topic: { type: "string", example: "Quantum Physics" },
                level: { type: "string", example: "Intermediate" },
                createdAt: { type: "string", format: "date-time" },
              },
            },
          },
        },

        // ── Error schemas ─────────────────────────────────────────────────
        ValidationError: {
          type: "object",
          description: "One or more request fields failed validation.",
          properties: {
            success: { type: "boolean", example: false },
            error: {
              type: "object",
              properties: {
                code: { type: "string", example: "VALIDATION_ERROR" },
                message: {
                  type: "string",
                  example: "Request validation failed. 2 issues found.",
                },
                fields: {
                  type: "array",
                  description: "Per-field breakdown of validation failures.",
                  items: {
                    type: "object",
                    properties: {
                      field: { type: "string", example: "level" },
                      message: {
                        type: "string",
                        example:
                          "Field 'level' must be one of: Beginner, Intermediate, Advanced.",
                      },
                    },
                  },
                },
              },
            },
          },
        },

        RateLimitError: {
          type: "object",
          description: "Client has exceeded the rate limit for this endpoint.",
          properties: {
            success: { type: "boolean", example: false },
            error: {
              type: "object",
              properties: {
                code: { type: "string", example: "RATE_LIMIT_EXCEEDED" },
                message: {
                  type: "string",
                  example:
                    "You have exceeded the allowed 60 requests per 15 minutes from this IP address. Please wait 843 seconds before trying again.",
                },
                retryAfterSeconds: {
                  type: "integer",
                  description: "Seconds to wait before the next request will be accepted.",
                  example: 843,
                },
              },
            },
          },
        },

        GenerationError: {
          type: "object",
          description:
            "The AI model failed to produce valid content after retries. Usually caused by an unusual prompt.",
          properties: {
            success: { type: "boolean", example: false },
            error: {
              type: "object",
              properties: {
                code: { type: "string", example: "GENERATION_ERROR" },
                message: {
                  type: "string",
                  example:
                    "Failed to generate valid quiz questions after 2 attempts. Please try rephrasing your prompt or try again shortly.",
                },
              },
            },
          },
        },

        PayloadTooLargeError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: {
              type: "object",
              properties: {
                code: { type: "string", example: "PAYLOAD_TOO_LARGE" },
                message: {
                  type: "string",
                  example:
                    "Request body exceeds the 10kb size limit. Please shorten your prompt or topic and try again.",
                },
              },
            },
          },
        },

        NotFoundError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: {
              type: "object",
              properties: {
                code: { type: "string", example: "NOT_FOUND" },
                message: {
                  type: "string",
                  example:
                    "Route 'GET /api/unknown' does not exist. Available endpoints: GET /api/health, POST /api/generate.",
                },
              },
            },
          },
        },

        InternalError: {
          type: "object",
          description: "Unexpected server error or upstream AI service failure.",
          properties: {
            success: { type: "boolean", example: false },
            error: {
              type: "object",
              properties: {
                code: {
                  type: "string",
                  enum: [
                    "INTERNAL_ERROR",
                    "AI_AUTH_ERROR",
                    "AI_FORBIDDEN",
                    "AI_MODEL_NOT_FOUND",
                    "AI_CONTEXT_TOO_LONG",
                    "AI_INTERNAL_ERROR",
                    "AI_SERVICE_UNAVAILABLE",
                    "AI_TIMEOUT",
                    "AI_UNREACHABLE",
                    "CONNECTION_RESET",
                  ],
                  example: "INTERNAL_ERROR",
                },
                message: {
                  type: "string",
                  example:
                    "An unexpected server error occurred. Please try again. If the problem persists, please contact support.",
                },
                retryAfterSeconds: {
                  type: "integer",
                  description: "Only present for `AI_RATE_LIMITED` and `AI_SERVICE_UNAVAILABLE`.",
                  example: 60,
                },
              },
            },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.js"],
};

export const swaggerSpec = swaggerJsdoc(options);
