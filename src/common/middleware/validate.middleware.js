/**
 * Validation middleware factory.
 *
 * Accepts a DTO class (which extends BaseDto) and returns an Express
 * middleware that validates `req.body` against the DTO's Joi schema.
 *
 * If validation passes, `req.body` is replaced with the cleaned value
 * (unknown fields stripped). If it fails, a 400 ApiError is thrown
 * which the global error handler will catch and send back as JSON.
 *
 * Usage in routes:
 *   router.post("/register", validate(RegisterDto), controller.register);
 */
import ApiError from "../utils/api-error.js";

const validate = (DtoClass) => {
  return (req, res, next) => {
    const { errors, value } = DtoClass.validate(req.body);

    if (errors) {
      // Join all error messages into a single string for the response
      throw ApiError.badRequest(errors.join("; "));
    }

    // Replace req.body with the validated & sanitised data
    req.body = value;
    next();
  };
};

export default validate;