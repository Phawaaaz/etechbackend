import jwt from "jsonwebtoken";
import crypto from "crypto";

// Pin algorithm explicitly on both sign and verify to prevent algorithm confusion attacks
const ACCESS_ALGO = { algorithm: "HS256" };
const VERIFY_ACCESS = { algorithms: ["HS256"] };
const VERIFY_REFRESH = { algorithms: ["HS256"] };

export const signAccessToken = (userId) =>
  jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
    ...ACCESS_ALGO,
  });

export const signRefreshToken = (userId) =>
  jwt.sign({ sub: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    ...ACCESS_ALGO,
  });

export const verifyAccessToken = (token) =>
  jwt.verify(token, process.env.JWT_SECRET, VERIFY_ACCESS);

export const verifyRefreshToken = (token) =>
  jwt.verify(token, process.env.JWT_REFRESH_SECRET, VERIFY_REFRESH);

// Store a SHA-256 hash of the refresh token in the DB instead of plaintext.
// If the DB is breached, raw tokens cannot be replayed.
export const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");
