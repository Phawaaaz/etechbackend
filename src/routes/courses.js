import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { protect } from "../middleware/auth.js";
import { Course } from "../models/Course.js";
import { generate } from "../services/groqService.js";
import { buildCourseIndexPrompts, buildTopicDiscoveryPrompts } from "../services/coursePrompts.js";
import { generateLimiter } from "../middleware/rateLimiter.js";

const router = Router();
router.use(protect);

const discoverSchema = z.object({
  subject: z.string().min(2).max(100).trim(),
  level: z.enum(["Beginner", "Intermediate", "Advanced"]),
});

const generateSchema = z.object({
  subject: z.string().min(2).max(100).trim(),
  topic: z.string().min(2).max(100).trim(),
  level: z.enum(["Beginner", "Intermediate", "Advanced"]),
});

/**
 * @openapi
 * /api/courses/discover:
 *   post:
 *     tags: [Courses]
 *     summary: Discover available courses for a subject and level
 *     description: |
 *       Step 1 of the course creation flow.
 *       The user types a subject and selects a difficulty level.
 *       The AI returns 8-12 recommended courses to choose from.
 *       The user browses the list, picks or edits one, then calls POST /api/courses/generate.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, level]
 *             properties:
 *               subject: { type: string, example: "Computer Science" }
 *               level: { type: string, enum: [Beginner, Intermediate, Advanced], example: "Beginner" }
 *           examples:
 *             cs_beginner:
 *               summary: Computer Science — Beginner
 *               value: { subject: "Computer Science", level: "Beginner" }
 *             math_intermediate:
 *               summary: Mathematics — Intermediate
 *               value: { subject: "Mathematics", level: "Intermediate" }
 *     responses:
 *       200:
 *         description: List of 8-12 recommended courses. User picks one and calls POST /api/courses/generate.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     subject: { type: string, example: "Computer Science" }
 *                     level: { type: string, example: "Beginner" }
 *                     courses:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           title: { type: string, example: "Introduction to Data Structures & Algorithms" }
 *                           description: { type: string }
 *                           estimatedHours: { type: number, example: 12 }
 *                           prerequisites: { type: array, items: { type: string } }
 *                           tags: { type: array, items: { type: string }, example: ["foundational", "popular"] }
 *       400:
 *         description: Validation error.
 *       500:
 *         description: AI generation failed.
 */
router.post("/discover", generateLimiter, async (req, res, next) => {
  try {
    const result = discoverSchema.safeParse(req.body);
    if (!result.success) {
      const fields = result.error.errors.map((e) => ({ field: e.path.join("."), message: e.message }));
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Validation failed.", fields },
      });
    }

    const { subject, level } = result.data;
    const { systemPrompt, userPrompt } = buildTopicDiscoveryPrompts(subject, level);

    let courses;
    try {
      const raw = await generate(systemPrompt, userPrompt);
      courses = JSON.parse(raw);
    } catch {
      // Retry once on parse failure
      const raw = await generate(systemPrompt, userPrompt);
      courses = JSON.parse(raw);
    }

    if (!Array.isArray(courses)) {
      return res.status(500).json({
        success: false,
        error: { code: "GENERATION_ERROR", message: "Failed to generate course list. Please try again." },
      });
    }

    res.json({
      success: true,
      data: {
        subject,
        level,
        courses,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/courses/generate:
 *   post:
 *     tags: [Courses]
 *     summary: Generate a full course curriculum (Step 2 — after /discover)
 *     description: |
 *       Step 2 of the course creation flow.
 *       The user picks a topic from the list returned by POST /api/courses/discover
 *       (or types their own), then calls this endpoint to generate the full curriculum.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, topic, level]
 *             properties:
 *               subject: { type: string, example: "Computer Science" }
 *               topic: { type: string, example: "Machine Learning" }
 *               level: { type: string, enum: [Beginner, Intermediate, Advanced] }
 *     responses:
 *       201:
 *         description: Course index generated and saved.
 *       400:
 *         description: Validation error.
 */
router.post("/generate", generateLimiter, async (req, res, next) => {
  try {
    const result = generateSchema.safeParse(req.body);
    if (!result.success) {
      const fields = result.error.errors.map((e) => ({ field: e.path.join("."), message: e.message }));
      return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Course generation validation failed.", fields } });
    }

    const { subject, topic, level } = result.data;
    const { systemPrompt, userPrompt } = buildCourseIndexPrompts(subject, topic, level);

    let parsed;
    try {
      const raw = await generate(systemPrompt, userPrompt);
      parsed = JSON.parse(raw);
    } catch {
      const raw = await generate(systemPrompt, userPrompt);
      parsed = JSON.parse(raw);
    }

    const course = await Course.create({
      userId: req.user._id,
      subject,
      topic,
      level,
      description: parsed.description,
      estimatedHours: parsed.estimatedHours,
      index: parsed.sections.map((s) => ({
        order: s.order,
        title: s.title,
        summary: s.summary,
        estimatedMinutes: s.estimatedMinutes || 15,
      })),
    });

    res.status(201).json({
      success: true,
      data: {
        course: {
          id: course._id,
          subject: course.subject,
          topic: course.topic,
          level: course.level,
          description: course.description,
          estimatedHours: course.estimatedHours,
          prerequisites: parsed.prerequisites || [],
          learningOutcomes: parsed.learningOutcomes || [],
          index: course.index,
          createdAt: course.createdAt,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/courses:
 *   get:
 *     tags: [Courses]
 *     summary: List all courses for the current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of courses.
 */
router.get("/", async (req, res, next) => {
  try {
    const courses = await Course.find({ userId: req.user._id }).sort({ createdAt: -1 }).select("-index");
    res.json({ success: true, data: { courses } });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/courses/{id}:
 *   get:
 *     tags: [Courses]
 *     summary: Get a single course with its full index
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Course with section index.
 *       404:
 *         description: Course not found.
 */
router.get("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Course not found or you do not have access to it." } });
    }
    const course = await Course.findOne({ _id: req.params.id, userId: req.user._id });
    if (!course) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Course not found or you do not have access to it." } });
    }
    res.json({ success: true, data: { course } });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/courses/{id}:
 *   delete:
 *     tags: [Courses]
 *     summary: Delete a course and all its sections
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Course deleted.
 *       404:
 *         description: Course not found.
 */
router.delete("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Course not found or you do not have access to it." } });
    }
    const course = await Course.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!course) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Course not found or you do not have access to it." } });
    }
    res.json({ success: true, data: { message: "Course deleted successfully." } });
  } catch (err) {
    next(err);
  }
});

export default router;
