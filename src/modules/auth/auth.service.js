/**
 * Auth service — pure business logic, no HTTP objects (req/res).
 *
 * Each function receives only the data it needs and returns a result
 * or throws an ApiError.  The controller layer calls these functions
 * and translates the result into an HTTP response.
 */
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../../common/config/email.js";
import ApiError from "../../common/utils/api-error.js";
import {
  generateAccessToken,
  generateRefreshToken,
  generateResetToken,
  verifyRefreshToken,
  hashToken,
} from "../../common/utils/jwt.utils.js";
import User from "./auth.model.js";

// ─────────────────────── Register ───────────────────────

/**
 * Register a new user.
 *
 * 1. Check if the email is already taken.
 * 2. Generate a verification token pair (raw + hashed).
 * 3. Create the user with the hashed token stored in the DB.
 * 4. Send a verification email containing the raw token.
 * 5. Return the user object (without sensitive fields).
 */
const register = async ({ name, email, password, role }) => {
  // Prevent duplicate registrations
  const existing = await User.findOne({ email });
  if (existing) throw ApiError.conflict("Email already exists");

  // Generate a random token for email verification
  const { rawToken, hashedToken } = generateResetToken();

  // Create user — password is auto-hashed by the pre-save hook
  const user = await User.create({
    name,
    email,
    password,
    role,
    verificationToken: hashedToken, // Store only the hash
  });

  // Attempt to send verification email (non-blocking on failure)
  try {
    await sendVerificationEmail(email, rawToken); // FIX: was `token` (undefined), now `rawToken`
  } catch (error) {
    console.error("Failed to send verification email:", error.message);
  }

  // Strip sensitive fields before returning
  const userObj = user.toObject();
  delete userObj.password;
  delete userObj.verificationToken;

  return userObj;
};

// ──────────────────────── Login ─────────────────────────

/**
 * Authenticate a user with email + password.
 *
 * 1. Find user by email (include password for comparison).
 * 2. Compare supplied password against the bcrypt hash.
 * 3. Ensure the email has been verified.
 * 4. Issue an access token (short-lived) and refresh token (long-lived).
 * 5. Hash the refresh token and store it in the DB (for rotation).
 */
const login = async ({ email, password }) => {
  // `.select("+password")` overrides `select: false` on the schema
  const user = await User.findOne({ email }).select("+password");
  if (!user) throw ApiError.unauthorized("Invalid email or password");

  // Compare plain text against bcrypt hash
  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw ApiError.unauthorized("Invalid email or password");

  // Block unverified users
  if (!user.isVerified) {
    throw ApiError.forbidden("Please verify your email before logging in");
  }

  // Generate token pair
  const accessToken = generateAccessToken({ id: user._id, role: user.role });
  const refreshToken = generateRefreshToken({ id: user._id });

  // Store hashed refresh token — never store the raw token in the DB
  user.refreshToken = hashToken(refreshToken);
  await user.save({ validateBeforeSave: false });

  // Clean user object for the response
  const userObj = user.toObject();
  delete userObj.password;
  delete userObj.refreshToken;

  return { user: userObj, accessToken, refreshToken };
};

// ─────────────────── Refresh Token ──────────────────────

/**
 * Issue a new access token using a valid refresh token.
 *
 * 1. Verify the JWT signature of the refresh token.
 * 2. Find the user and compare the hashed token against the DB value.
 * 3. If valid, return a fresh access token.
 *
 * This implements "refresh-token rotation" — the server can detect
 * token reuse if the stored hash doesn't match.
 */
const refresh = async (token) => {
  if (!token) throw ApiError.unauthorized("Refresh token missing");

  // Verify JWT signature and expiry
  const decoded = verifyRefreshToken(token);

  // Fetch user with stored refresh token hash
  const user = await User.findById(decoded.id).select("+refreshToken");
  if (!user) throw ApiError.unauthorized("User not found");

  // Compare incoming token hash against stored hash
  if (user.refreshToken !== hashToken(token)) {
    throw ApiError.unauthorized("Invalid refresh token — possible reuse detected");
  }

  // Issue new access token
  const accessToken = generateAccessToken({ id: user._id, role: user.role });
  return { accessToken };
};

// ──────────────────────── Logout ────────────────────────

/**
 * Log out a user by clearing their stored refresh token.
 * The client must also discard the access token and clear the cookie.
 */
const logout = async (userId) => {
  // Nullify the refresh token in the database
  await User.findByIdAndUpdate(userId, { refreshToken: null });
};

// ───────────────── Forgot Password ──────────────────────

/**
 * Initiate a password-reset flow.
 *
 * 1. Find the user by email.
 * 2. Generate a random token (raw + hashed).
 * 3. Store the hash and an expiry (15 minutes) in the DB.
 * 4. Email the raw token to the user.
 */
const forgotPassword = async (email) => {
  const user = await User.findOne({ email });
  if (!user) throw ApiError.notFound("No account with that email");

  const { rawToken, hashedToken } = generateResetToken();
  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes

  await user.save({ validateBeforeSave: false });

  // Send the reset email
  try {
    await sendPasswordResetEmail(email, rawToken);
  } catch (error) {
    // Rollback token fields if email fails
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save({ validateBeforeSave: false });
    throw ApiError.badRequest("Failed to send reset email. Please try again.");
  }
};

// ──────────────── Reset Password ────────────────────────

/**
 * Complete a password reset using the token from the email link.
 *
 * 1. Hash the incoming raw token.
 * 2. Find a user whose resetPasswordToken matches AND whose expiry
 *    is still in the future.
 * 3. Set the new password and clear the reset fields.
 */
const resetPassword = async (token, newPassword) => {
  const hashedToken = hashToken(token);

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() }, // Must not be expired
  }).select("+resetPasswordToken");

  if (!user) throw ApiError.badRequest("Token is invalid or has expired");

  // Update password (pre-save hook will hash it)
  user.password = newPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  return user;
};

// ────────────────── Verify Email ────────────────────────

/**
 * Verify a user's email address using the token from the verification link.
 *
 * 1. Hash the incoming raw token.
 * 2. Find the user with a matching verificationToken.
 * 3. Mark as verified and clear the token.
 */
const verifyEmail = async (token) => {
  const hashedToken = hashToken(token);
  const user = await User.findOne({ verificationToken: hashedToken }).select(
    "+verificationToken",
  );

  // FIX: original code had no check — would crash if user is null
  if (!user) throw ApiError.badRequest("Invalid or expired verification token");

  user.isVerified = true;
  user.verificationToken = undefined;
  await user.save({ validateBeforeSave: false });

  return user;
};

// ──────────────────── Get Profile ───────────────────────

/**
 * Fetch the current user's profile by ID.
 */
const getMe = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound("User not found");
  return user;
};

export {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  getMe,
};
