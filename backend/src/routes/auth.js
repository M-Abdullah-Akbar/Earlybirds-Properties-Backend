const express = require("express");
const router = express.Router();
const { login, changePassword } = require("../controllers/authController");

// Import validation middleware
const {
  loginValidation,
  changePasswordValidation,
} = require("../middleware/validation");

// Import auth middleware
const { authWithPassword } = require("../middleware/auth");

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
router.put(
  "/change-password",
  authWithPassword,
  changePasswordValidation,
  changePassword
);

module.exports = router;
