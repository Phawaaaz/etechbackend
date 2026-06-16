import cron from "node-cron";
import { logger } from "../config/logger.js";

/**
 * Pings the /api/health endpoint every 14 minutes to prevent Render's
 * free-tier server from spinning down (which happens after 15 min of inactivity).
 *
 * RENDER_EXTERNAL_URL is set automatically by Render in all environments.
 * The job is skipped if that variable is absent (e.g. local dev).
 */
export const startKeepAlive = () => {
  const baseUrl = process.env.RENDER_EXTERNAL_URL;

  if (!baseUrl) {
    logger.info("Keep-alive job skipped (RENDER_EXTERNAL_URL not set).");
    return;
  }

  const url = `${baseUrl}/api/health`;

  cron.schedule("*/14 * * * *", async () => {
    try {
      const res = await fetch(url);
      logger.info(`Keep-alive ping → ${url} [${res.status}]`);
    } catch (err) {
      logger.warn(`Keep-alive ping failed: ${err.message}`);
    }
  });

  logger.info(`Keep-alive job started — pinging ${url} every 14 minutes.`);
};
