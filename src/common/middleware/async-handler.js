/**
 * asyncHandler — wraps async route handlers to catch rejected promises.
 *
 * Without this, every async controller would need its own try-catch block.
 * This wrapper catches any thrown error (including ApiError) and forwards
 * it to Express's global error handler via next(err).
 *
 * Usage:
 *   router.get("/me", asyncHandler(controller.getMe));
 *
 * @param {Function} fn - Async Express handler (req, res, next) => Promise
 * @returns {Function}  Express middleware
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default asyncHandler;
