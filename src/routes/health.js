import { Router } from "express";

const router = Router();

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: Server liveness check
 *     description: Returns the current server status and timestamp. No authentication required.
 *     responses:
 *       200:
 *         description: Server is running normally.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-06-15T08:00:00.000Z"
 */
router.get("/", (req, res) => {
  res.json({ success: true, status: "ok", timestamp: new Date().toISOString() });
});

export default router;
