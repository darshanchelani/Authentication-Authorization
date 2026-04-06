/**
 * Express application setup.
 *
 * This file configures the Express app with:
 *   1. Body parsers (JSON & URL-encoded) — so req.body is populated.
 *   2. Cookie parser — so req.cookies is populated (for refresh tokens).
 *   3. Route mounting — each module's routes are prefixed with /api/<module>.
 *   4. Global error handler — catches all errors and sends a clean JSON response.
 *
 * The configured app is exported and used by server.js to start listening.
 */
import cookieParser from "cookie-parser";
import express from "express";
import authRoute from "./modules/auth/auth.routes.js";
import errorHandler from "./common/middleware/error-handler.js";

const app = express();

// ─── Body parsing middleware ─────────────────────────────
// Parse incoming JSON payloads (Content-Type: application/json)
app.use(express.json());

// Parse URL-encoded form data (Content-Type: application/x-www-form-urlencoded)
app.use(express.urlencoded({ extended: true }));

// Parse cookies from the Cookie header → populates req.cookies
app.use(cookieParser());

// ─── API Routes ──────────────────────────────────────────
// All auth endpoints are prefixed with /api/auth
app.use("/api/auth", authRoute);

// ─── Health check ────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Global error handler (must be LAST middleware) ──────
// Express identifies this as an error handler because it has 4 parameters
app.use(errorHandler);

export default app;
