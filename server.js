/**
 * Server entry point.
 *
 * 1. Loads environment variables from .env via dotenv.
 * 2. Connects to MongoDB.
 * 3. Starts the Express HTTP server.
 *
 * Separating "app" from "server" is a best practice:
 *   • app.js  — Express configuration, routes, middleware (testable in isolation).
 *   • server.js — actually binds to a port and starts listening (side-effect).
 */
import "dotenv/config";
import app from "./src/app.js";
import connectDB from "./src/common/config/db.js";

const PORT = process.env.PORT || 5000;

const start = async () => {
  // Connect to MongoDB before accepting requests
  await connectDB();

  app.listen(PORT, () => {
    console.log(
      `Server is running at http://localhost:${PORT} in ${process.env.NODE_ENV || "development"} mode`,
    );
  });
};

// Start the server — if anything fails, log and exit with a non-zero code
start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
