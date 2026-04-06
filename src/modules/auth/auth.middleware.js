/**
 * Authentication & Authorisation middleware.
 *
 * • authenticate — verifies the JWT access token from the Authorization header.
 * • authorize    — checks whether the authenticated user has one of the allowed roles.
 *
 * These are used as Express route middleware:
 *   router.get("/admin", authenticate, authorize("admin"), controller.adminDashboard);
 */
import ApiError from "../../common/utils/api-error.js"; // FIX: was missing .js extension
import { verifyAccessToken } from "../../common/utils/jwt.utils.js";
import User from "./auth.model.js";

/**
 * Authentication middleware.
 *
 * Reads the Bearer token from the Authorization header, verifies it,
 * and attaches the user's core data to `req.user` so downstream
 * handlers can use it without a DB query.
 *
 * Flow:
 *   1. Extract the token from "Bearer <token>".
 *   2. Verify the JWT signature and expiry.
 *   3. Look up the user in the DB (to confirm they still exist).
 *   4. Attach { id, role, name, email } to req.user.
 */
const authenticate = async (req, res, next) => {
  let token;

  // The Authorization header format is: "Bearer <jwt>"
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) throw ApiError.unauthorized("Not authenticated — token missing");

  try {
    // Decode the JWT — throws if expired or tampered
    const decoded = verifyAccessToken(token);

    // Confirm the user still exists (they might have been deleted)
    const user = await User.findById(decoded.id);
    if (!user) throw ApiError.unauthorized("User no longer exists");

    // Attach a lean user object to the request for downstream use
    req.user = {
      id: user._id,
      role: user.role,
      name: user.name,
      email: user.email,
    };

    next();
  } catch (error) {
    // Catch JWT verification errors (expired, invalid signature, etc.)
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      throw ApiError.unauthorized("Invalid or expired token");
    }
    throw error; // Re-throw non-JWT errors
  }
};

/**
 * Authorisation middleware factory.
 *
 * Returns a middleware that checks whether `req.user.role` is among
 * the allowed roles. Must be used AFTER `authenticate`.
 *
 * @param  {...string} roles - Allowed roles (e.g. "admin", "seller")
 * @returns {Function} Express middleware
 *
 * Example:
 *   authorize("admin")           — only admins
 *   authorize("admin", "seller") — admins or sellers
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw ApiError.forbidden(
        "You do not have permission to perform this action",
      );
    }
    next();
  };
};

export { authenticate, authorize };
