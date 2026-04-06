/**
 * LoginDto — Validates the request body for user login.
 *
 * Fields:
 *   • email    — valid email, lowercased
 *   • password — required (no min length check here — that's for registration)
 */
import Joi from "joi";
import BaseDto from "../../../common/dto/base.dto.js";

class LoginDto extends BaseDto {
  static schema = Joi.object({
    email: Joi.string().email().lowercase().required()
      .messages({ "string.email": "Please provide a valid email address" }),
    password: Joi.string().required()
      .messages({ "any.required": "Password is required" }),
  });
}

export default LoginDto;
