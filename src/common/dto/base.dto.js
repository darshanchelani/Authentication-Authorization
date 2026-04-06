/**
 * BaseDto — Abstract base class for request validation using Joi.
 *
 * Every DTO (Data Transfer Object) extends this class and overrides
 * `schema` with its own Joi schema.  The inherited `validate()` method
 * runs the schema against incoming data and returns either validated
 * values or an array of human-readable error messages.
 *
 * Options used:
 *   • abortEarly: false — collect ALL errors, not just the first one.
 *   • stripUnknown: true — silently remove fields not defined in the schema.
 */
import Joi from "joi";

class BaseDto {
  // Default empty schema — subclasses MUST override this.
  static schema = Joi.object({});

  /**
   * Validate data against the subclass schema.
   * @param {Object} data - Request body to validate
   * @returns {{ errors: string[] | null, value: Object | null }}
   */
  static validate(data) {
    const { error, value } = this.schema.validate(data, {
      abortEarly: false,   // Report every validation failure
      stripUnknown: true,  // Remove extra fields not in the schema
    });

    if (error) {
      // Extract just the human-readable messages from Joi's detail objects
      const errors = error.details.map((d) => d.message);
      return { errors, value: null };
    }

    return { errors: null, value };
  }
}

export default BaseDto;