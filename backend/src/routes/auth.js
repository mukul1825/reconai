const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const User = require("../models/User");
const { ApiError } = require("../utils/apiError");
const { asyncHandler } = require("../middleware/errorHandler");

const router = express.Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function signToken(userId) {
  return jwt.sign({ sub: userId.toString() }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

// POST /api/v1/auth/register
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError("MISSING_REQUIRED_FIELD", "Email and password (min 8 chars) are required.", 400);
    }
    const { email, password } = parsed.data;

    const existing = await User.findOne({ email });
    if (existing) {
      throw new ApiError("AUTH_EMAIL_TAKEN", "An account with this email already exists.", 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, passwordHash });

    res.status(201).json({ token: signToken(user._id) });
  })
);

// POST /api/v1/auth/login
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError("MISSING_REQUIRED_FIELD", "Email and password are required.", 400);
    }
    const { email, password } = parsed.data;

    const user = await User.findOne({ email });
    if (!user) {
      throw new ApiError("AUTH_INVALID_CREDENTIALS", "Invalid email or password.", 401);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new ApiError("AUTH_INVALID_CREDENTIALS", "Invalid email or password.", 401);
    }

    res.json({ token: signToken(user._id) });
  })
);

module.exports = router;
