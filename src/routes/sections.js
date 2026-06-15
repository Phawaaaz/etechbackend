import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { Course } from "../models/Course.js";
import { Section } from "../models/Section.js";
import { assembleSection } from "../services/contentAssembler.js";
import { generateLimiter } from "../middleware/rateLimiter.js";

const router = Router({ mergeParams: true });
router.use(protect);

/**
 * @openapi
 * /api/courses/{courseId}/sections/generate/{order}:
 *   post:
 *     tags: [Sections]
 *     summary: Generate deep content for a section by its order number
 *     description: |
 *       Triggers multi-pass AI generation for a section. This includes:
 *       - 3-4 paragraph overview
 *       - 3-4 concepts, each with deep explanation + contextual diagram
 *       - Full worked example with code
 *       - Common mistakes & misconceptions
 *       - Key takeaways
 *       - 5 scenario-based quiz questions
 *       - Further reading suggestions
 *
 *       **Note:** This call takes 15-30 seconds due to multiple AI passes.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: order
 *         required: true
 *         schema: { type: integer }
 *         description: Section order number from the course index (1-based)
 *     responses:
 *       201:
 *         description: Section generated and saved.
 *       404:
 *         description: Course or section index entry not found.
 *       409:
 *         description: Section already generated. Use GET to retrieve it.
 */
router.post("/generate/:order", generateLimiter, async (req, res, next) => {
  try {
    const course = await Course.findOne({ _id: req.params.courseId, userId: req.user._id });
    if (!course) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Course not found or you do not have access to it." } });
    }

    const order = parseInt(req.params.order, 10);
    const indexEntry = course.index.find((s) => s.order === order);
    if (!indexEntry) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: `No section with order ${order} found in this course's index.` } });
    }

    // Return cached section if already generated
    const existing = await Section.findOne({ courseId: course._id, order });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: {
          code: "ALREADY_EXISTS",
          message: `Section "${indexEntry.title}" has already been generated. Use GET /api/courses/${course._id}/sections/${existing._id} to retrieve it.`,
        },
      });
    }

    const assembled = await assembleSection({
      topic: course.topic,
      subject: course.subject,
      sectionTitle: indexEntry.title,
      sectionOrder: order,
      level: course.level,
      allSections: course.index,
    });

    const section = await Section.create({
      courseId: course._id,
      userId: req.user._id,
      ...assembled,
    });

    res.status(201).json({ success: true, data: { section } });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/courses/{courseId}/sections:
 *   get:
 *     tags: [Sections]
 *     summary: List all generated sections for a course
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of generated sections (without full content — use GET /:sectionId for full detail).
 */
router.get("/", async (req, res, next) => {
  try {
    const sections = await Section.find({ courseId: req.params.courseId, userId: req.user._id })
      .sort({ order: 1 })
      .select("order title createdAt");
    res.json({ success: true, data: { sections } });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/courses/{courseId}/sections/{sectionId}:
 *   get:
 *     tags: [Sections]
 *     summary: Get full content for a generated section
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Full section with all content blocks, quiz, and takeaways.
 *       404:
 *         description: Section not found.
 */
router.get("/:sectionId", async (req, res, next) => {
  try {
    const section = await Section.findOne({
      _id: req.params.sectionId,
      courseId: req.params.courseId,
      userId: req.user._id,
    });
    if (!section) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Section not found or you do not have access to it." } });
    }
    res.json({ success: true, data: { section } });
  } catch (err) {
    next(err);
  }
});

export default router;
