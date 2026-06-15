import { Router } from "express";
import { z } from "zod";
import { User } from "../models/User.js";
import { Course } from "../models/Course.js";
import { Section } from "../models/Section.js";
import { Progress } from "../models/Progress.js";
import { protect } from "../middleware/auth.js";

const router = Router();
router.use(protect);

// ── Validation schemas ────────────────────────────────────────────────────────

const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name must be at most 80 characters")
    .trim()
    .optional(),
  email: z
    .string()
    .email("Please provide a valid email address")
    .toLowerCase()
    .trim()
    .optional(),
}).refine((d) => d.name || d.email, {
  message: "Provide at least one field to update: name or email.",
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters.")
    .max(128, "New password must be at most 128 characters."),
}).refine((d) => d.currentPassword !== d.newPassword, {
  message: "New password must be different from your current password.",
  path: ["newPassword"],
});

const deleteAccountSchema = z.object({
  password: z.string().min(1, "Password is required to delete your account."),
  confirm: z.literal("DELETE", {
    errorMap: () => ({ message: "Type the word DELETE to confirm account deletion." }),
  }),
});

// ── GET /api/users/me ─────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/users/me:
 *   get:
 *     tags: [Users]
 *     summary: Get current user profile with stats
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile and learning stats.
 */
router.get("/me", async (req, res, next) => {
  try {
    const [courseCount, completedSections] = await Promise.all([
      Course.countDocuments({ userId: req.user._id }),
      Progress.countDocuments({ userId: req.user._id, status: "completed" }),
    ]);

    res.json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          createdAt: req.user.createdAt,
          updatedAt: req.user.updatedAt,
        },
        stats: {
          totalCourses: courseCount,
          sectionsCompleted: completedSections,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/users/me ───────────────────────────────────────────────────────

/**
 * @openapi
 * /api/users/me:
 *   patch:
 *     tags: [Users]
 *     summary: Update name and/or email
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, example: "Phawaaz Akinola" }
 *               email: { type: string, example: "new@example.com" }
 *     responses:
 *       200:
 *         description: Profile updated.
 *       400:
 *         description: Validation error or email already in use.
 */
router.patch("/me", async (req, res, next) => {
  try {
    const result = updateProfileSchema.safeParse(req.body);
    if (!result.success) {
      const fields = result.error.errors.map((e) => ({ field: e.path.join("."), message: e.message }));
      return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Profile update validation failed.", fields } });
    }

    const updates = result.data;

    // Check email uniqueness if changing email
    if (updates.email && updates.email !== req.user.email) {
      const existing = await User.findOne({ email: updates.email });
      if (existing) {
        return res.status(400).json({
          success: false,
          error: { code: "EMAIL_IN_USE", message: "This email address is already associated with another account." },
        });
      }
    }

    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      data: {
        user: { id: updated._id, name: updated.name, email: updated.email, updatedAt: updated.updatedAt },
        message: "Profile updated successfully.",
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/users/me/password ─────────────────────────────────────────────

/**
 * @openapi
 * /api/users/me/password:
 *   patch:
 *     tags: [Users]
 *     summary: Change password
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Password changed. All other sessions are invalidated.
 *       401:
 *         description: Current password is incorrect.
 */
router.patch("/me/password", async (req, res, next) => {
  try {
    const result = changePasswordSchema.safeParse(req.body);
    if (!result.success) {
      const fields = result.error.errors.map((e) => ({ field: e.path.join("."), message: e.message }));
      return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Password change validation failed.", fields } });
    }

    const { currentPassword, newPassword } = result.data;

    const user = await User.findById(req.user._id).select("+password");
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "Your current password is incorrect." },
      });
    }

    // Setting password triggers the pre-save hash hook; also invalidate all refresh tokens
    user.password = newPassword;
    user.refreshToken = null;
    await user.save();

    res.json({
      success: true,
      data: { message: "Password changed successfully. Please log in again with your new password." },
    });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/users/me ──────────────────────────────────────────────────────

/**
 * @openapi
 * /api/users/me:
 *   delete:
 *     tags: [Users]
 *     summary: Permanently delete account and all associated data
 *     description: |
 *       Requires password confirmation and typing the word `DELETE`.
 *       Deletes the user account and all courses, sections, and progress records.
 *       **This action is irreversible.**
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password, confirm]
 *             properties:
 *               password: { type: string, description: "Your current password" }
 *               confirm: { type: string, enum: [DELETE], description: "Must be the word DELETE" }
 *     responses:
 *       200:
 *         description: Account and all data deleted.
 *       401:
 *         description: Password incorrect.
 */
router.delete("/me", async (req, res, next) => {
  try {
    const result = deleteAccountSchema.safeParse(req.body);
    if (!result.success) {
      const fields = result.error.errors.map((e) => ({ field: e.path.join("."), message: e.message }));
      return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Account deletion validation failed.", fields } });
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!(await user.comparePassword(result.data.password))) {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "Password is incorrect. Account deletion cancelled." },
      });
    }

    // Delete all user data in parallel
    await Promise.all([
      User.findByIdAndDelete(req.user._id),
      Course.deleteMany({ userId: req.user._id }),
      Section.deleteMany({ userId: req.user._id }),
      Progress.deleteMany({ userId: req.user._id }),
    ]);

    res.json({
      success: true,
      data: { message: "Your account and all associated data have been permanently deleted." },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/users/me/courses ─────────────────────────────────────────────────

/**
 * @openapi
 * /api/users/me/courses:
 *   get:
 *     tags: [Users]
 *     summary: Get all courses with progress summary for the current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Courses with completion percentage.
 */
router.get("/me/courses", async (req, res, next) => {
  try {
    const courses = await Course.find({ userId: req.user._id }).sort({ createdAt: -1 });

    // Attach progress summary to each course
    const coursesWithProgress = await Promise.all(
      courses.map(async (course) => {
        const allProgress = await Progress.find({ courseId: course._id, userId: req.user._id });
        const completed = allProgress.filter((p) => p.status === "completed").length;
        const totalSections = course.index.length;
        const generatedSections = await Section.countDocuments({ courseId: course._id });

        return {
          id: course._id,
          subject: course.subject,
          topic: course.topic,
          level: course.level,
          description: course.description,
          estimatedHours: course.estimatedHours,
          totalSections,
          generatedSections,
          completedSections: completed,
          percentComplete: totalSections > 0 ? Math.round((completed / totalSections) * 100) : 0,
          createdAt: course.createdAt,
        };
      })
    );

    res.json({ success: true, data: { courses: coursesWithProgress } });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/users/me/activity ────────────────────────────────────────────────

/**
 * @openapi
 * /api/users/me/activity:
 *   get:
 *     tags: [Users]
 *     summary: Get recent learning activity
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Last 20 completed/in-progress sections with timestamps.
 */
router.get("/me/activity", async (req, res, next) => {
  try {
    const activity = await Progress.find({ userId: req.user._id, status: { $ne: "not_started" } })
      .sort({ updatedAt: -1 })
      .limit(20)
      .populate("sectionId", "title order")
      .populate("courseId", "topic subject");

    res.json({ success: true, data: { activity } });
  } catch (err) {
    next(err);
  }
});

export default router;
