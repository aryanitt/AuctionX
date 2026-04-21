const User = require('../models/User');
const { generateToken } = require('../utils/generateToken');
const { asyncHandler } = require('../utils/asyncHandler');

/**
 * POST /api/auth/register
 * Register a new user. Password hashed via User model pre-save hook.
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({
      success: false,
      error: 'Name, email, password and role are all required.',
    });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(409).json({
      success: false,
      error: 'An account with this email already exists.',
    });
  }

  const user = await User.create({ name, email, password, role });
  const token = generateToken(user);

  res.status(201).json({
    success: true,
    data: {
      token,
      user: user.toJSON(), // password stripped by toJSON()
    },
  });
});

/**
 * POST /api/auth/login
 * Authenticate user with email + password, return JWT.
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required.',
    });
  }

  // Fetch user WITH password for comparison (password is normally excluded)
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Invalid email or password.',
    });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(401).json({
      success: false,
      error: 'Invalid email or password.',
    });
  }

  const token = generateToken(user);

  res.json({
    success: true,
    data: {
      token,
      user: user.toJSON(),
    },
  });
});

/**
 * GET /api/auth/me
 * Return the currently authenticated user (req.user set by authMiddleware).
 */
const getMe = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: { user: req.user },
  });
});

module.exports = { register, login, getMe };
