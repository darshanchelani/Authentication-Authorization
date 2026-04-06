/**
 * ResetPasswordDto — Validates the request body for password reset completion.
 *
 * Fields:
 *   • password        — minimum 8 characters
 *   • confirmPassword — must match password (Joi.ref)
 */
import Joi from "joi";
import BaseDto from "../../../common/dto/base.dto.js";

class ResetPasswordDto extends BaseDto {
  static schema = Joi.object({
    password: Joi.string().min(8).required()
      .messages({ "string.min": "Password must be at least 8 characters" }),
    confirmPassword: Joi.string().valid(Joi.ref("password")).required()
      .messages({ "any.only": "Passwords do not match" }),
  });
}

export default ResetPasswordDto;
