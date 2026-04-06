/**
 * Email transport configuration using Nodemailer.
 *
 * Provides two helpers:
 *   • sendMail()              — generic email sender
 *   • sendVerificationEmail() — sends a verification link with token
 *   • sendPasswordResetEmail() — sends a password-reset link with token
 *
 * SMTP credentials are read from environment variables.
 */
import nodemailer from "nodemailer";

// Create a reusable SMTP transporter object.
// In production you'd use a service like SendGrid, SES, or Mailgun.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.example.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // true for port 465, false for others (uses STARTTLS)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send a generic email.
 * @param {string} to      - Recipient email address
 * @param {string} subject - Email subject line
 * @param {string} html    - Email body (HTML)
 */
const sendMail = async (to, subject, html) => {
  await transporter.sendMail({
    from: process.env.SMTP_FROM_EMAIL,
    to,
    subject,
    html,
  });
};

/**
 * Send a verification email with a clickable link.
 * The link contains the raw token; the server hashes it again on receipt.
 *
 * @param {string} email - Recipient email
 * @param {string} token - Raw (unhashed) verification token
 */
const sendVerificationEmail = async (email, token) => {
  // Build the verification URL pointing to our API endpoint
  const verifyUrl = `${process.env.FRONTEND_URL || "http://localhost:5000"}/api/auth/verify-email/${token}`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM_EMAIL,
    to: email, // FIX: was `email` as a property name instead of `to`
    subject: "Verify your email address",
    html: `
      <h1>Email Verification</h1>
      <p>Click the link below to verify your email address:</p>
      <a href="${verifyUrl}">${verifyUrl}</a>
      <p>This link is valid for a limited time. If you did not create an account, please ignore this email.</p>
    `,
  });
};

/**
 * Send a password-reset email with a clickable link.
 *
 * @param {string} email - Recipient email
 * @param {string} token - Raw reset token
 */
const sendPasswordResetEmail = async (email, token) => {
  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password/${token}`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM_EMAIL,
    to: email,
    subject: "Password Reset Request",
    html: `
      <h1>Password Reset</h1>
      <p>You requested a password reset. Click the link below to set a new password:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>This link expires in 15 minutes. If you did not request a reset, ignore this email.</p>
    `,
  });
};

export { sendMail, sendVerificationEmail, sendPasswordResetEmail };
