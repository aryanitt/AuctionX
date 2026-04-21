const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { asyncHandler } = require('../utils/asyncHandler');

/**
 * Middleware: Verify JWT from Authorization header and attach user to req.
 * Expects header: Authorization: Bearer <token>
 */
const authMiddleware = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Access denied. No token provided.',
    });
  }

  const token = authHeader.split(' ')[1];

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id).select('-password');

  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Token is valid but user no longer exists.',
    });
  }

  req.user = user;
  next();
});

module.exports = { authMiddleware };
