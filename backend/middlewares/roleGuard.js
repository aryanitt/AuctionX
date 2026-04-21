/**
 * Role-based access guard middleware factory.
 * Must be used AFTER authMiddleware (req.user must be set).
 *
 * @param {...string} allowedRoles - Roles permitted to access the route
 * @returns {Function} Express middleware
 */
const roleGuard = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Only ${allowedRoles.join(' or ')} can perform this action.`,
      });
    }

    next();
  };
};

// Convenience shorthand guards
const buyerOnly = roleGuard('buyer');
const supplierOnly = roleGuard('supplier');

module.exports = { roleGuard, buyerOnly, supplierOnly };
