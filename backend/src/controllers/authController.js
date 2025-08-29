const User = require("../models/User");

/**
 * Admin login
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    // Input validation is now handled by middleware

    // Find user by username and include password

    const user = await User.findOne({ username }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: "Account is not active. Please contact SuperAdmin.",
      });
    }

    // Check if account is locked
    if (user.isLocked()) {
      return res.status(423).json({
        success: false,
        error:
          "Account is temporarily locked due to too many failed login attempts. Please try again later.",
        lockUntil: user.lockUntil,
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      // Increment login attempts
      await user.incrementLoginAttempts();

      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
        attemptsRemaining: Math.max(
          0,
          parseInt(process.env.MAX_LOGIN_ATTEMPTS) - user.loginAttempts
        ),
      });
    }

    // Successful login - update last login and reset attempts
    await user.updateLastLogin();

    // Generate JWT token
    const token = user.generateAuthToken();

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          lastLogin: user.lastLogin,
        },
        token,
      },
      message: "Login successful",
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({
      success: false,
      error: "Login failed",
    });
  }
};

/**
 * Change password
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // 🚀 OPTIMIZATION: Use pre-loaded user document from authWithPassword middleware
    // No need for additional database call - user is already loaded with password
    const user = req.userDocument;

    // Security check: Ensure user document exists (should always exist after authWithPassword)
    if (!user) {
      return res.status(500).json({
        success: false,
        error: "Authentication error. Please try again.",
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);

    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        error: "Current password is incorrect",
      });
    }

    // Update password
    user.password = newPassword;

    // Update password change timestamp
    user.passwordChangedAt = new Date();

    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
      data: {
        passwordChangedAt: user.passwordChangedAt,
      },
    });
  } catch (error) {
    console.error("❌ Error changing password:", error);

    res.status(500).json({
      success: false,
      error: "Failed to change password",
    });
  }
};

module.exports = {
  login,
  changePassword,
};
