/**
 * Auth routes — maps HTTP endpoints to controller functions.
 *
 * Route overview:
 *   POST   /api/auth/register            → Create a new user
 *   POST   /api/auth/login               → Authenticate & get tokens
 *   POST   /api/auth/logout              → Clear refresh token (protected)
 *   POST   /api/auth/refresh-token       → Get a new access token
 *   POST   /api/auth/forgot-password     → Request password reset email
 *   POST   /api/auth/reset-password/:token → Set new password
 *   GET    /api/auth/verify-email/:token  → Verify email address
 *   GET    /api/auth/me                   → Get current user profile (protected)
 *
 * Middleware chain for protected routes:
 *   authenticate → (optional: authorize) → controller
 */
import { Router } from "express";
import * as controller from "./auth.controller.js";
import validate from "../../common/middleware/validate.middleware.js";
import asyncHandler from "../../common/middleware/async-handler.js";
import RegisterDto from "./dto/register.dto.js";
import LoginDto from "./dto/login.dto.js";
import ForgotPasswordDto from "./dto/forgot-password.dto.js";
import ResetPasswordDto from "./dto/reset-password.dto.js";
import { authenticate } from "./auth.middleware.js";

const router = Router();

// ─── Public routes (no authentication required) ─────────

// Register a new user account
router.post("/register", validate(RegisterDto), asyncHandler(controller.register));

// Login with email & password
router.post("/login", validate(LoginDto), asyncHandler(controller.login));

// Get a new access token using the refresh token cookie
router.post("/refresh-token", asyncHandler(controller.refreshToken));

// Verify email address using the token sent during registration
router.get("/verify-email/:token", asyncHandler(controller.verifyEmail));

// Request a password reset email
router.post("/forgot-password", validate(ForgotPasswordDto), asyncHandler(controller.forgotPassword));

// Reset password using the token from the email
router.post("/reset-password/:token", validate(ResetPasswordDto), asyncHandler(controller.resetPassword));

// ─── Protected routes (authentication required) ─────────

// Logout — clears the refresh token
router.post("/logout", asyncHandler(authenticate), asyncHandler(controller.logout));

// Get current user's profile
router.get("/me", asyncHandler(authenticate), asyncHandler(controller.getMe));

export default router;
