/**
 * RegisterDto — Validates the request body for user registration.
 *
 * Fields:
 *   • name     — 2-50 chars, trimmed
 *   • email    — valid email, lowercased
 *   • password — minimum 8 characters
 *   • role     — "customer" (default) or "seller" (admin cannot self-register)
 */
import Joi from "joi";
import BaseDto from "../../../common/dto/base.dto.js";

class RegisterDto extends BaseDto {
  static schema = Joi.object({
    name: Joi.string().trim().min(2).max(50).required()
      .messages({ "string.min": "Name must be at least 2 characters" }),
    email: Joi.string().email().lowercase().required()
      .messages({ "string.email": "Please provide a valid email address" }),
    password: Joi.string().min(8).required()
      .messages({ "string.min": "Password must be at least 8 characters" }),
    role: Joi.string().valid("customer", "seller").default("customer")
      .messages({ "any.only": "Role must be either customer or seller" }),
  });
}

export default RegisterDto;