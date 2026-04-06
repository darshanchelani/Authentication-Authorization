/**
 * Global error-handling middleware.
 *
 * Express recognises this as an error handler because it has 4 parameters.
 * All errors thrown or passed via next(err) end up here.
 *
 * • ApiError instances  → use their statusCode and message.
 * • Mongoose errors     → translated to user-friendly messages.
 * • Unknown errors      → generic 500 Internal Server Error.
 */
import ApiError from "../utils/api-error.js";

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Log the full error in development for debugging
  if (process.env.NODE_ENV === "development") {
    console.error("Error:", err);
  }

  // ─── Known ApiError ────────────────────────────────────
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // ─── Mongoose validation error (e.g. required field missing) ───
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: messages.join("; "),
    });
  }

  // ─── Mongoose duplicate key error (code 11000) ────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      success: false,
      message: `${field} already exists`,
    });
  }

  // ─── Mongoose bad ObjectId ────────────────────────────
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: `Invalid ${err.path}: ${err.value}`,
    });
  }

  // ─── JWT errors ───────────────────────────────────────
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Token has expired",
    });
  }

  // ─── Fallback: unknown / unexpected error ─────────────
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};

export default errorHandler;
