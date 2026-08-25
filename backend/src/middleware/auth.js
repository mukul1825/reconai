const jwt = require("jsonwebtoken");
const { ApiError } = require("../utils/apiError");

function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return next(new ApiError("AUTH_MISSING_TOKEN", "Missing or malformed Authorization header.", 401));
  }

  const token = header.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch (err) {
    next(new ApiError("AUTH_INVALID_TOKEN", "Token is invalid or expired.", 401));
  }
}

module.exports = { requireAuth };
