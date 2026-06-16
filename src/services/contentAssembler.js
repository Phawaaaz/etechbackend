import { generate } from "./groqService.js";
import { generateImageUrl } from "./imageService.js";
import { logger } from "../config/logger.js";
import {
  buildSectionOverviewPrompts,
  buildConceptPrompts,
  buildConceptImagePrompts,
  buildWorkedExamplePrompts,
  buildMistakesPrompts,
  buildTakeawaysPrompts,
  buildQuizPrompts,
  buildFurtherReadingPrompts,
} from "./coursePrompts.js";

const parseJson = async (systemPrompt, userPrompt, label) => {
  const attempt = async () => {
    const raw = await generate(systemPrompt, userPrompt);
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error(`Invalid JSON from AI for ${label}`);
    }
  };
  try {
    return await attempt();
  } catch {
    logger.warn(`Retrying JSON generation for: ${label}`);
    return await attempt();
  }
};

// Derive 3-4 concept titles from section title + topic using Groq
const deriveConceptTitles = async (topic, sectionTitle, level) => {
  const systemPrompt = `You are a curriculum designer. List 3-4 core concepts that should be taught in the section titled "${sectionTitle}" of a course on "${topic}" for a ${level} learner.
Return a valid JSON array ONLY — no markdown. Schema: ["concept title string"]
Each concept should be a distinct, teachable sub-topic that together cover the full section.`;
  const raw = await generate(systemPrompt, `List concepts for: "${sectionTitle}"`);
  try {
    return JSON.parse(raw);
  } catch {
    return [sectionTitle];
  }
};

// Build a full section by chaining multiple focused AI calls
export const assembleSection = async ({ topic, subject, sectionTitle, sectionOrder, level, allSections }) => {
  logger.info(`Assembling section: "${sectionTitle}"`);

  // Run independent passes in parallel where possible
  const [overview, conceptTitles] = await Promise.all([
    generate(
      buildSectionOverviewPrompts(topic, sectionTitle, level, allSections).systemPrompt,
      buildSectionOverviewPrompts(topic, sectionTitle, level, allSections).userPrompt
    ),
    deriveConceptTitles(topic, sectionTitle, level),
  ]);

  // Build each concept deeply — sequentially to stay within rate limits
  const concepts = [];
  for (const conceptTitle of conceptTitles) {
    const { systemPrompt: cSys, userPrompt: cUser } = buildConceptPrompts(topic, sectionTitle, conceptTitle, level);
    const explanation = await generate(cSys, cUser);

    // Generate contextual image for this concept
    const { systemPrompt: iSys, userPrompt: iUser } = buildConceptImagePrompts(topic, sectionTitle, conceptTitle, explanation.slice(0, 200));
    const imagePrompt = await generate(iSys, iUser);
    const imageUrl = generateImageUrl(imagePrompt);

    concepts.push({
      title: conceptTitle,
      blocks: [
        { type: "text", content: explanation, order: 1 },
        { type: "image", content: imageUrl, caption: `Diagram: ${conceptTitle}`, order: 2 },
      ],
    });
  }

  // Run remaining passes in parallel
  const [workedExample, commonMistakes, keyTakeaways, quiz, furtherReading] = await Promise.all([
    parseJson(
      buildWorkedExamplePrompts(topic, sectionTitle, level).systemPrompt,
      buildWorkedExamplePrompts(topic, sectionTitle, level).userPrompt,
      "workedExample"
    ),
    parseJson(
      buildMistakesPrompts(topic, sectionTitle, level).systemPrompt,
      buildMistakesPrompts(topic, sectionTitle, level).userPrompt,
      "commonMistakes"
    ),
    parseJson(
      buildTakeawaysPrompts(topic, sectionTitle).systemPrompt,
      buildTakeawaysPrompts(topic, sectionTitle).userPrompt,
      "keyTakeaways"
    ),
    parseJson(
      buildQuizPrompts(topic, sectionTitle, level).systemPrompt,
      buildQuizPrompts(topic, sectionTitle, level).userPrompt,
      "quiz"
    ),
    parseJson(
      buildFurtherReadingPrompts(topic, sectionTitle).systemPrompt,
      buildFurtherReadingPrompts(topic, sectionTitle).userPrompt,
      "furtherReading"
    ),
  ]);

  return {
    order: sectionOrder,
    title: sectionTitle,
    overview,
    concepts,
    workedExample: {
      problem: workedExample.problem || "",
      steps: workedExample.steps || [],
      code: workedExample.code || "",
      language: workedExample.language || "none",
      expectedOutput: workedExample.expectedOutput || "",
    },
    commonMistakes: Array.isArray(commonMistakes) ? commonMistakes : [],
    keyTakeaways: Array.isArray(keyTakeaways) ? keyTakeaways : [],
    furtherReading: Array.isArray(furtherReading) ? furtherReading : [],
    quiz: Array.isArray(quiz) ? quiz : [],
  };
};
