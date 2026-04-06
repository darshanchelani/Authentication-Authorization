/**
 * JWT & Crypto token utilities.
 *
 * • Access tokens  — short-lived (default 15 min), sent in Authorization header.
 * • Refresh tokens — long-lived (default 7 days), stored in httpOnly cookie.
 * • Reset tokens   — one-time random strings hashed with SHA-256 before DB storage.
 */
import crypto from "crypto";
import jwt from "jsonwebtoken";

// ───────────────────── Access Token ─────────────────────

/**
 * Create a signed JWT access token.
 * @param {Object} payload - Data to encode (e.g. { id, role })
 * @returns {string} Signed JWT
 */
const generateAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  });
};

/**
 * Verify and decode an access token.
 * Throws a JsonWebTokenError / TokenExpiredError on failure.
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
};

// ───────────────────── Refresh Token ────────────────────

/**
 * Create a signed JWT refresh token (longer expiry).
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  });
};

/**
 * Verify and decode a refresh token.
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

// ──────────────── Random Reset / Verification Token ─────

/**
 * Generate a cryptographically random token pair.
 *   • rawToken    — sent to the user (in an email link).
 *   • hashedToken — stored in the database for comparison.
 *
 * On verification, the incoming raw token is hashed again and
 * compared against the stored hash — the raw token is never persisted.
 */
const generateResetToken = () => {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  return { rawToken, hashedToken };
};

/**
 * Hash a raw token with SHA-256 (used when comparing against DB value).
 */
const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

export {
  generateAccessToken,
  generateRefreshToken,
  generateResetToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
};
