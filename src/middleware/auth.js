import { verifyAccessToken } from "../config/jwt.js";
import { User } from "../models/User.js";

export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "No access token provided. Include 'Authorization: Bearer <token>' in your request headers.",
      },
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.sub).select("+passwordChangedAt");

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "The user belonging to this token no longer exists.",
        },
      });
    }

    // Reject tokens issued before the last password change
    if (user.passwordChangedAfter(decoded.iat)) {
      return res.status(401).json({
        success: false,
        error: {
          code: "TOKEN_INVALIDATED",
          message: "Your password was recently changed. Please log in again.",
        },
      });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        error: {
          code: "TOKEN_EXPIRED",
          message: "Your access token has expired. Use POST /api/auth/refresh to get a new one.",
        },
      });
    }

    return res.status(401).json({
      success: false,
      error: {
        code: "INVALID_TOKEN",
        message: "The access token is invalid or malformed.",
      },
    });
  }
};
