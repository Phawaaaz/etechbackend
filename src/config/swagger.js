import swaggerJsdoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Etech API",
      version: "1.0.0",
      description:
        "AI-powered educational content generation API. Supports text, audio, image, interactive quiz, and video storyboard formats powered by Groq (llama-3.3-70b-versatile) and Pollinations.ai.",
      contact: {
        name: "Etech Support",
        email: "phawaazakinola@gmail.com",
      },
    },
    servers: [
      {
        url: "http://localhost:5000",
        description: "Local development server",
      },
    ],
    tags: [
      { name: "Health", description: "Server liveness check" },
      { name: "Generate", description: "AI educational content generation" },
    ],
    components: {
      schemas: {
        // ── Request ──────────────────────────────────────────────
        GenerateRequest: {
          type: "object",
          required: ["format", "prompt", "topic", "level"],
          properties: {
            format: {
              type: "string",
              enum: ["text", "audio", "image", "interactive", "video"],
              description:
                "Content format to generate. `text` returns markdown, `audio` returns a spoken script, `image` returns a Pollinations.ai URL, `interactive` returns a 5-question quiz array, `video` returns a 5-scene storyboard array.",
              example: "text",
            },
            prompt: {
              type: "string",
              minLength: 5,
              maxLength: 500,
              description: "The educational task or question. HTML is stripped automatically.",
              example: "Explain quantum computing",
            },
            topic: {
              type: "string",
              minLength: 2,
              maxLength: 100,
              description: "Subject area of the content. HTML is stripped automatically.",
              example: "Quantum Physics",
            },
            level: {
              type: "string",
              enum: ["Beginner", "Intermediate", "Advanced"],
              description: "Target difficulty level for the generated content.",
              example: "Beginner",
            },
          },
        },

        // ── Content variants ─────────────────────────────────────
        QuizQuestion: {
          type: "object",
          properties: {
            question: { type: "string", example: "What is a qubit?" },
            options: {
              type: "array",
              items: { type: "string" },
              minItems: 4,
              maxItems: 4,
              example: ["A classical bit", "A quantum bit", "A binary unit", "A logic gate"],
            },
            answer: { type: "string", example: "A quantum bit" },
            explanation: {
              type: "string",
              example: "A qubit is the basic unit of quantum information, analogous to a classical bit but able to exist in superposition.",
            },
          },
        },

        VideoScene: {
          type: "object",
          properties: {
            scene: { type: "integer", example: 1 },
            title: { type: "string", example: "Introduction to Quantum Computing" },
            narration: {
              type: "string",
              example: "Welcome to the world of quantum computing, where the rules of classical physics no longer apply...",
            },
            visual_description: {
              type: "string",
              example: "Animation of a glowing qubit spinning in superposition against a dark background.",
            },
          },
        },

        // ── Responses ────────────────────────────────────────────
        GenerateResponseText: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                id: { type: "string", example: "gen_3f2a1b4c-..." },
                format: { type: "string", example: "text" },
                content: {
                  type: "string",
                  description: "Markdown-formatted educational explanation (text) or spoken script (audio) or Pollinations image URL (image).",
                  example: "## Quantum Computing\n\nQuantum computing harnesses...",
                },
                topic: { type: "string", example: "Quantum Physics" },
                level: { type: "string", example: "Beginner" },
                createdAt: { type: "string", format: "date-time", example: "2026-06-15T08:00:00.000Z" },
              },
            },
          },
        },

        GenerateResponseInteractive: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                id: { type: "string", example: "gen_3f2a1b4c-..." },
                format: { type: "string", example: "interactive" },
                content: {
                  type: "array",
                  items: { $ref: "#/components/schemas/QuizQuestion" },
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
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                id: { type: "string", example: "gen_3f2a1b4c-..." },
                format: { type: "string", example: "video" },
                content: {
                  type: "array",
                  items: { $ref: "#/components/schemas/VideoScene" },
                },
                topic: { type: "string", example: "Quantum Physics" },
                level: { type: "string", example: "Beginner" },
                createdAt: { type: "string", format: "date-time" },
              },
            },
          },
        },

        // ── Errors ───────────────────────────────────────────────
        ValidationError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: {
              type: "object",
              properties: {
                code: { type: "string", example: "VALIDATION_ERROR" },
                message: { type: "string", example: "Request validation failed. 1 issue found." },
                fields: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      field: { type: "string", example: "level" },
                      message: { type: "string", example: "Field 'level' must be one of: Beginner, Intermediate, Advanced." },
                    },
                  },
                },
              },
            },
          },
        },

        RateLimitError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: {
              type: "object",
              properties: {
                code: { type: "string", example: "RATE_LIMIT_EXCEEDED" },
                message: { type: "string", example: "You have exceeded the allowed 20 requests per 15 minutes from this IP address. Please wait 843 seconds before trying again." },
                retryAfterSeconds: { type: "integer", example: 843 },
              },
            },
          },
        },

        GenerationError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: {
              type: "object",
              properties: {
                code: { type: "string", example: "GENERATION_ERROR" },
                message: { type: "string", example: "Failed to generate valid quiz questions after 2 attempts. Please try rephrasing your prompt." },
              },
            },
          },
        },

        InternalError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: {
              type: "object",
              properties: {
                code: { type: "string", example: "INTERNAL_ERROR" },
                message: { type: "string", example: "An unexpected server error occurred. Please try again." },
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
