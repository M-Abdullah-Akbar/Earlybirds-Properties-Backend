const express = require("express");
const router = express.Router();
const {
  login,
  changePassword,
  logout,
} = require("../controllers/authController");

// Import validation middleware
const {
  loginValidation,
  changePasswordValidation,
} = require("../middleware/validation");

// Import auth middleware
const { auth } = require("../middleware/auth");

/**
 * @route   POST /api/auth/login
 * @desc    Admin login
 * @access  Public
 */
router.post("/login", loginValidation, login);

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change password
 * @access  Private
 */
router.put("/change-password", auth, changePasswordValidation, changePassword);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout (client-side token removal)
 * @access  Private
 */
router.post("/logout", auth, logout);

module.exports = router;
