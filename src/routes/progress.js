import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { protect } from "../middleware/auth.js";
import { sensitiveActionLimiter } from "../middleware/rateLimiter.js";
import { Progress } from "../models/Progress.js";
import { Section } from "../models/Section.js";

const router = Router({ mergeParams: true });
router.use(protect);

/**
 * @openapi
 * /api/courses/{courseId}/progress:
 *   get:
 *     tags: [Progress]
 *     summary: Get full progress summary for a course
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Progress records for all sections in the course.
 */
router.get("/progress", async (req, res, next) => {
  try {
    const progress = await Progress.find({ courseId: req.params.courseId, userId: req.user._id })
      .populate("sectionId", "title order");

    const completed = progress.filter((p) => p.status === "completed").length;
    const total = progress.length;

    res.json({
      success: true,
      data: {
        courseId: req.params.courseId,
        completedSections: completed,
        totalSections: total,
        percentComplete: total > 0 ? Math.round((completed / total) * 100) : 0,
        sections: progress,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/courses/{courseId}/sections/{sectionId}/progress:
 *   patch:
 *     tags: [Progress]
 *     summary: Mark a section as in_progress or completed
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [in_progress, completed]
 *     responses:
 *       200:
 *         description: Progress updated.
 */
router.patch("/sections/:sectionId/progress", async (req, res, next) => {
  try {
    const statusSchema = z.enum(["in_progress", "completed"]);
    const parsed = statusSchema.safeParse(req.body.status);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Status must be 'in_progress' or 'completed'." } });
    }

    const update = { status: parsed.data };
    if (parsed.data === "completed") update.completedAt = new Date();

    const progress = await Progress.findOneAndUpdate(
      { userId: req.user._id, courseId: req.params.courseId, sectionId: req.params.sectionId },
      { $set: update },
      { upsert: true, new: true }
    );

    res.json({ success: true, data: { progress } });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/courses/{courseId}/sections/{sectionId}/quiz:
 *   post:
 *     tags: [Progress]
 *     summary: Submit quiz answers and receive score with explanations
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [answers]
 *             properties:
 *               answers:
 *                 type: array
 *                 items: { type: string }
 *                 description: Array of 5 answer strings, one per quiz question.
 *                 example: ["A quantum bit", "Gradient descent", "Overfitting", "It returns an error", "Random Forest"]
 *     responses:
 *       200:
 *         description: Score and per-question feedback.
 *       404:
 *         description: Section not found.
 */
const answersSchema = z.array(z.string().max(500)).min(1).max(10);

router.post("/sections/:sectionId/quiz", sensitiveActionLimiter, async (req, res, next) => {
  try {
    // Validate sectionId is a valid ObjectId
    if (!mongoose.isValidObjectId(req.params.sectionId)) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Section not found." } });
    }

    // Validate answers array — each item must be a string, max 10 items
    const parsed = answersSchema.safeParse(req.body.answers);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Provide an 'answers' array of strings (max 10 items, each max 500 chars)." } });
    }
    const answers = parsed.data;

    const section = await Section.findOne({ _id: req.params.sectionId, courseId: req.params.courseId, userId: req.user._id });
    if (!section) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Section not found." } });
    }

    const quiz = section.quiz;
    const feedback = quiz.map((q, i) => {
      const userAnswer = answers[i] ?? null;
      const correct = userAnswer === q.answer;
      return {
        question: q.question,
        yourAnswer: userAnswer,
        correct,
        explanation: q.explanation,
        // Only reveal the correct answer for questions the user got wrong
        ...(correct ? {} : { correctAnswer: q.answer }),
      };
    });

    const correctCount = feedback.filter((f) => f.correct).length;
    const score = Math.round((correctCount / quiz.length) * 100);
    const passed = score >= 60;

    // Save attempt to progress
    const attempt = { answers, score, passed, attemptedAt: new Date() };
    const progress = await Progress.findOneAndUpdate(
      { userId: req.user._id, courseId: req.params.courseId, sectionId: req.params.sectionId },
      {
        $push: { quizAttempts: attempt },
        $max: { bestQuizScore: score },
        ...(passed ? { $set: { status: "completed", completedAt: new Date() } } : {}),
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      data: {
        score,
        passed,
        correctCount,
        totalQuestions: quiz.length,
        feedback,
        message: passed
          ? `Great work! You scored ${score}% and passed this section.`
          : `You scored ${score}%. You need 60% to pass. Review the section and try again.`,
        bestScore: progress.bestQuizScore,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
