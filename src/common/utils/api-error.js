/**
 * ApiError — Custom error class for consistent HTTP error responses.
 *
 * Extends the built-in Error class so that thrown errors carry an HTTP
 * status code. The global error-handler middleware reads `statusCode`
 * to set the response status automatically.
 *
 * Static factory methods provide a readable, self-documenting API:
 *   throw ApiError.notFound("User not found");
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code (e.g. 400, 401, 404)
   * @param {string} message    - Human-readable error description
   */
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;

    // Capture the stack trace, excluding the constructor call itself,
    // so the trace starts at the call-site where the error was created.
    Error.captureStackTrace(this, this.constructor);
  }

  /** 400 — The request body / params are invalid */
  static badRequest(message = "Bad request") {
    return new ApiError(400, message);
  }

  /** 401 — Missing or invalid credentials (authentication failure) */
  static unauthorized(message = "Unauthorized") {
    return new ApiError(401, message);
  }

  /** 403 — Authenticated but lacking permission (authorization failure) */
  static forbidden(message = "Forbidden") {
    return new ApiError(403, message); // FIX: was 412, should be 403
  }

  /** 404 — Resource not found */
  static notFound(message = "Not found") {
    return new ApiError(404, message); // FIX: was 412, should be 404
  }

  /** 409 — Resource conflict (e.g. duplicate email) */
  static conflict(message = "Conflict") {
    return new ApiError(409, message);
  }
}

export default ApiError;
