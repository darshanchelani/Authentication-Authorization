/**
 * Auth controller — translates HTTP requests into service calls
 * and service results into HTTP responses.
 *
 * Controllers should be thin — they:
 *   1. Extract data from req (body, params, cookies).
 *   2. Call the appropriate service function.
 *   3. Send a standardised response via ApiResponse.
 *
 * Async errors are caught by the asyncHandler wrapper (applied in routes).
 */
import * as authService from "./auth.service.js";
import ApiResponse from "../../common/utils/api-response.js";

// ────────────── POST /api/auth/register ─────────────────

/**
 * Register a new user.
 * Body: { name, email, password, role? }
 */
const register = async (req, res) => {
  const user = await authService.register(req.body);
  ApiResponse.created(res, "Registration successful. Please check your email to verify.", user);
};

// ─────────────── POST /api/auth/login ───────────────────

/**
 * Log in with email & password.
 * Returns access token in the JSON body and sets the refresh token
 * as an httpOnly cookie (the browser sends it automatically on
 * subsequent requests, but JS cannot read it — XSS protection).
 */
const login = async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.login(req.body);

  // Set refresh token as a secure, httpOnly cookie
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,   // Not accessible via document.cookie (XSS protection)
    secure: true,     // Only sent over HTTPS
    sameSite: "strict", // CSRF protection
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  });

  ApiResponse.ok(res, "Login successful", { user, accessToken });
};

// ──────────── POST /api/auth/refresh-token ──────────────

/**
 * Get a new access token using the refresh token cookie.
 * The refresh token is read from the httpOnly cookie (not the body).
 */
const refreshToken = async (req, res) => {
  // Read the refresh token from the cookie set during login
  const token = req.cookies.refreshToken;
  const result = await authService.refresh(token);
  ApiResponse.ok(res, "Token refreshed", result);
};

// ──────────────── POST /api/auth/logout ─────────────────

/**
 * Log out the current user.
 * Clears the refresh token from the DB and the cookie.
 */
const logout = async (req, res) => {
  await authService.logout(req.user.id);
  // Remove the refresh token cookie from the browser
  res.clearCookie("refreshToken");
  ApiResponse.ok(res, "Logout successful");
};

// ─────────── POST /api/auth/forgot-password ─────────────

/**
 * Initiate password reset — sends a reset link to the user's email.
 * Body: { email }
 */
const forgotPassword = async (req, res) => {
  await authService.forgotPassword(req.body.email);
  ApiResponse.ok(res, "Password reset email sent (if the account exists)");
};

// ────────── POST /api/auth/reset-password/:token ────────

/**
 * Complete the password reset using the token from the email link.
 * Params: token (from URL)
 * Body: { password }
 */
const resetPassword = async (req, res) => {
  await authService.resetPassword(req.params.token, req.body.password);
  ApiResponse.ok(res, "Password has been reset successfully");
};

// ─────────── GET /api/auth/verify-email/:token ──────────

/**
 * Verify the user's email using the token sent during registration.
 */
const verifyEmail = async (req, res) => {
  await authService.verifyEmail(req.params.token);
  ApiResponse.ok(res, "Email verified successfully");
};

// ────────────────── GET /api/auth/me ────────────────────

/**
 * Get the currently authenticated user's profile.
 * Requires a valid access token (authenticate middleware).
 */
const getMe = async (req, res) => {
  const user = await authService.getMe(req.user.id);
  ApiResponse.ok(res, "User profile", user);
};

export {
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  getMe,
};
