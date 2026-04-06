/**
 * ForgotPasswordDto — Validates the request body for password reset initiation.
 *
 * Fields:
 *   • email — valid email, lowercased
 */
import Joi from "joi";
import BaseDto from "../../../common/dto/base.dto.js";

class ForgotPasswordDto extends BaseDto {
  static schema = Joi.object({
    email: Joi.string().email().lowercase().required()
      .messages({ "string.email": "Please provide a valid email address" }),
  });
}

export default ForgotPasswordDto;
