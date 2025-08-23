const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Optional authentication middleware
 * Adds user info to req.user if valid token is provided, but doesn't block request if no token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const optionalAuth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header("Authorization");

    // If no auth header, continue without user info
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      req.user = null;
      return next();
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // If no token, continue without user info
    if (!token) {
      req.user = null;
      return next();
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from database
      const user = await User.findById(decoded.id).select("-password");

      if (!user) {
        // User not found, continue without user info
        req.user = null;
        return next();
      }

      // Check if account is locked (protects against brute force attacks)
      // Even with valid token, locked accounts should not have access
      if (user.isLocked && user.isLocked()) {
        // Account locked, continue without user info
        req.user = null;
        return next();
      }

      // Add user to request
      req.user = user;
      next();
    } catch (tokenError) {
      // Invalid token, continue without user info
      req.user = null;
      next();
    }
  } catch (error) {
    // Any error, continue without user info
    console.error("Optional auth error:", error);
    req.user = null;
    next();
  }
};

module.exports = optionalAuth;
