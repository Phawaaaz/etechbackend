import { Router } from "express";
import { z } from "zod";
import { protect } from "../middleware/auth.js";
import { Course } from "../models/Course.js";
import { generate } from "../services/groqService.js";
import { buildCourseIndexPrompts } from "../services/coursePrompts.js";
import { generateLimiter } from "../middleware/rateLimiter.js";

const router = Router();
router.use(protect);

const generateSchema = z.object({
  subject: z.string().min(2).max(100).trim(),
  topic: z.string().min(2).max(100).trim(),
  level: z.enum(["Beginner", "Intermediate", "Advanced"]),
});

/**
 * @openapi
 * /api/courses/generate:
 *   post:
 *     tags: [Courses]
 *     summary: Generate a new course curriculum from a topic
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
