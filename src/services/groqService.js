import Groq from "groq-sdk";
import { config } from "../config/env.js";

const client = new Groq({ apiKey: config.groqApiKey });

export const generate = async (systemPrompt, userPrompt) => {
  const response = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 2048,
  });
  return response.choices[0].message.content;
};
