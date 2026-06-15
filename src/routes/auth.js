import { Router } from "express";
import { z } from "zod";
import { User } from "../models/User.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../config/jwt.js";
import { protect } from "../middleware/auth.js";
import rateLimit from "express-rate-limit";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many auth attempts. Please wait 15 minutes." },
    }),
});

const registerSchema = z.object({
  name: z.string().min(2).max(80).trim(),
  email: z.string().email("Please provide a valid email address").toLowerCase().trim(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1, "Password is required"),
});

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Create a new account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, example: Phawaaz }
 *               email: { type: string, example: phawaaz@example.com }
 *               password: { type: string, minLength: 8, example: securepass123 }
 *     responses:
 *       201:
 *         description: Account created. Returns tokens.
 *       400:
 *         description: Validation error or email already in use.
 */
router.post("/register", authLimiter, async (req, res, next) => {
  try {
    const result = registerSchema.safeParse(req.body);
    if (!result.success) {
      const fields = result.error.errors.map((e) => ({ field: e.path.join("."), message: e.message }));
      return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Registration validation failed.", fields } });
    }

    const { name, email, password } = result.data;
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, error: { code: "EMAIL_IN_USE", message: "An account with this email address already exists. Please log in or use a different email." } });
    }

    const user = await User.create({ name, email, password });
    const accessToken = signAccessToken(user._id);
    const refreshToken = signRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    res.status(201).json({
      success: true,
      data: {
        user: { id: user._id, name: user.name, email: user.email },
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in to an existing account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: phawaaz@example.com }
 *               password: { type: string, example: securepass123 }
 *     responses:
 *       200:
 *         description: Login successful. Returns tokens.
 *       401:
 *         description: Invalid email or password.
 */
router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Please provide a valid email and password." } });
    }

    const { email, password } = result.data;
    const user = await User.findOne({ email }).select("+password +refreshToken");
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, error: { code: "INVALID_CREDENTIALS", message: "Incorrect email or password. Please check your credentials and try again." } });
    }

    const accessToken = signAccessToken(user._id);
    const refreshToken = signRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      data: {
        user: { id: user._id, name: user.name, email: user.email },
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh an expired access token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: New access token issued.
 *       401:
 *         description: Refresh token invalid or expired.
 */
router.post("/refresh", async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ success: false, error: { code: "MISSING_REFRESH_TOKEN", message: "Refresh token is required." } });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      return res.status(401).json({ success: false, error: { code: "INVALID_REFRESH_TOKEN", message: "The refresh token is invalid or has expired. Please log in again." } });
    }

    const user = await User.findById(decoded.sub).select("+refreshToken");
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ success: false, error: { code: "INVALID_REFRESH_TOKEN", message: "Refresh token does not match. Please log in again." } });
    }

    const newAccessToken = signAccessToken(user._id);
    const newRefreshToken = signRefreshToken(user._id);
    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    res.json({ success: true, data: { accessToken: newAccessToken, refreshToken: newRefreshToken } });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Log out (invalidate refresh token)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully.
 */
router.post("/logout", protect, async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
    res.json({ success: true, data: { message: "Logged out successfully." } });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user details.
 *       401:
 *         description: Not authenticated.
 */
router.get("/me", protect, (req, res) => {
  res.json({
    success: true,
    data: {
      user: { id: req.user._id, name: req.user.name, email: req.user.email, createdAt: req.user.createdAt },
    },
  });
});

export default router;
