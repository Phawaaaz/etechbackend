import mongoose from "mongoose";
import { logger } from "./logger.js";

let mongoServer;

export const connectDB = async () => {
  try {
    let uri = process.env.MONGODB_URI;

    // In development, if MONGODB_URI points to localhost, attempt connection with a short timeout.
    // If it fails, spin up MongoMemoryServer dynamically.
    if (process.env.NODE_ENV === "development" && uri && (uri.includes("localhost") || uri.includes("127.0.0.1"))) {
      try {
        const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 1500 });
        logger.info(`MongoDB connected (local service): ${conn.connection.host}`);
        return;
      } catch (connErr) {
        logger.warn(`Local MongoDB service not running. Starting in-memory MongoDB server fallback...`);
        const { MongoMemoryServer } = await import("mongodb-memory-server");
        mongoServer = await MongoMemoryServer.create();
        uri = mongoServer.getUri();
      }
    }

    const conn = await mongoose.connect(uri);
    logger.info(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    logger.error(`MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }
};
