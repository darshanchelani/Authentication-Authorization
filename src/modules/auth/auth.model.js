/**
 * User model (Mongoose schema).
 *
 * Stores user credentials, roles, and token fields for:
 *   • Email verification
 *   • JWT refresh-token rotation
 *   • Password reset
 *
 * Sensitive fields (password, tokens) have `select: false` so they
 * are excluded by default from query results — you must explicitly
 * `.select("+password")` to include them.
 *
 * The pre-save hook automatically hashes the password with bcrypt
 * whenever it is modified (registration or password reset).
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      minlength: 2,
      maxlength: 50,
      required: [true, "Name is required"],
    },
    email: {
      type: String,
      trim: true,
      required: [true, "Email is required"],
      unique: true,     // Creates a unique index — prevents duplicate emails
      lowercase: true,  // Normalise to lowercase before saving
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 8,
      select: false, // Never returned in queries unless explicitly selected
    },
    role: {
      type: String,
      enum: ["customer", "seller", "admin"], // Allowed roles
      default: "customer",
    },
    isVerified: {
      type: Boolean,
      default: false, // Must verify email before logging in
    },
    // Hashed email-verification token (compared against incoming raw token)
    verificationToken: { type: String, select: false },
    // Hashed refresh token — used for refresh-token rotation
    refreshToken: { type: String, select: false },
    // Password-reset fields
    resetPasswordToken: { type: String, select: false },   // FIX: consistent casing
    resetPasswordExpires: { type: Date, select: false },    // FIX: consistent casing
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  },
);

/**
 * Pre-save hook: hash the password with bcrypt before persisting.
 *
 * `isModified("password")` ensures we only re-hash when the password
 * field actually changed — not on every save.
 */
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  // Salt rounds = 12 (good balance of security vs speed)
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

/**
 * Instance method: compare a plain-text password against the stored hash.
 * Returns true if they match.
 */
userSchema.methods.comparePassword = async function (clearTextPassword) {
  return bcrypt.compare(clearTextPassword, this.password);
};

export default mongoose.model("User", userSchema);
