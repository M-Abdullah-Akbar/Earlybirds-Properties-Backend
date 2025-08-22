const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Authentication middleware to verify JWT tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const auth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Access denied. No valid token provided.",
      });
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Access denied. No token provided.",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid token. User not found.",
      });
    }

    // Add user to request object
    req.user = {
      _id: user._id, // Use _id for consistency with MongoDB
      id: user._id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    // Add userRole for ACL middleware
    req.userRole = user.role;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        error: "Invalid token.",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        error: "Token expired.",
      });
    }

    res.status(500).json({
      success: false,
      error: "Authentication failed.",
    });
  }
};

/**
 * Authentication middleware for password operations
 * Similar to auth middleware but includes password field for efficiency
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authWithPassword = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Access denied. No valid token provided.",
      });
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Access denied. No token provided.",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user WITH password field for password operations
    const user = await User.findById(decoded.id).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid token. User not found.",
      });
    }

    // Add full user document for password operations (includes password)
    req.userDocument = user;

    next();
  } catch (error) {
    console.error("Auth with password middleware error:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        error: "Invalid token.",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        error: "Token expired.",
      });
    }

    res.status(500).json({
      success: false,
      error: "Authentication failed.",
    });
  }
};

/**
 * Role-based authorization middleware
 * @param {Array} roles - Array of allowed roles
 * @returns {Function} Middleware function
 */
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Access denied. Authentication required.",
      });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: "Access denied. Insufficient permissions.",
      });
    }

    next();
  };
};

module.exports = {
  auth,
  authWithPassword,
  authorize,
};
