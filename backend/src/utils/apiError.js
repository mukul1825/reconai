/**
 * Standardized error shape:
 * { error: { code, message, request_id } }
 */
class ApiError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

// Central registry so codes stay consistent across routes.
const ErrorCodes = {
  AUTH_INVALID_CREDENTIALS: 401,
  AUTH_EMAIL_TAKEN: 409,
  AUTH_MISSING_TOKEN: 401,
  AUTH_INVALID_TOKEN: 401,
  INVALID_CSV_FORMAT: 400,
  MISSING_REQUIRED_FIELD: 400,
  BATCH_NOT_FOUND: 404,
  MATCH_NOT_FOUND: 404,
  MATCH_ALREADY_RESOLVED: 409,
  LLM_UNAVAILABLE: 502, // caught internally; agent layer falls back rather than surfacing this
};

module.exports = { ApiError, ErrorCodes };
