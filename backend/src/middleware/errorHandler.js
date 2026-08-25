const { randomUUID } = require("crypto");
const { ApiError, ErrorCodes } = require("../utils/apiError");

// Wrap async route handlers so thrown/rejected errors reach errorHandler
// without every route needing its own try/catch.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function errorHandler(err, req, res, next) {
  const requestId = randomUUID();

  if (err instanceof ApiError) {
    return res.status(err.statusCode || ErrorCodes[err.code] || 400).json({
      error: { code: err.code, message: err.message, request_id: requestId },
    });
  }

  // Unexpected errors: log full detail server-side, return a generic message.
  console.error(`[error] request_id=${requestId}`, err);
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong.",
      request_id: requestId,
    },
  });
}

module.exports = { errorHandler, asyncHandler };
