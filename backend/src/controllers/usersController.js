/**
 * User Management Controller (SuperAdmin Only)
 * Handles CRUD operations for user management
 */

const User = require("../models/User");

/**
 * Get user statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserStats = async (req, res) => {
  try {
    // Only SuperAdmin can access user statistics
    if (req.userRole !== "SuperAdmin") {
      return res.status(403).json({
        success: false,
        error: "Access denied - SuperAdmin only",
      });
    }

    const totalUsers = await User.countDocuments();
    const adminCount = await User.countDocuments({ role: "admin" });
    const superAdminCount = await User.countDocuments({ role: "SuperAdmin" });
    const activeUsers = await User.countDocuments({ isActive: true });
    const inactiveUsers = await User.countDocuments({ isActive: false });

    // Recent users (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentUsers = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    res.status(200).json({
      success: true,
      data: {
        total: totalUsers,
        byRole: {
          SuperAdmin: superAdminCount,
          admin: adminCount,
        },
        byStatus: {
          active: activeUsers,
          inactive: inactiveUsers,
        },
        recent: recentUsers,
      },
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch user statistics",
    });
  }
};

/**
 * Get all users with filtering and pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUsers = async (req, res) => {
  try {
    // Only SuperAdmin can access user list
    if (req.userRole !== "SuperAdmin") {
      return res.status(403).json({
        success: false,
        error: "Access denied - SuperAdmin only",
      });
    }

    const {
      page = 1,
      limit = 10,
      role,
      isActive,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Start with ACL query filters (SuperAdmin can see all)
    const filter = { ...req.queryFilters } || {};

    // Apply additional filters
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    // Search functionality
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-password") // Exclude password field
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit),
        },
        // Include filter info for debugging (SuperAdmin only)
        appliedFilters: filter,
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch users",
    });
  }
};

/**
 * Get single user by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch user",
    });
  }
};

/**
 * Create new user (admin)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createUser = async (req, res) => {
  try {
    // Only SuperAdmin can create users
    if (req.userRole !== "SuperAdmin") {
      return res.status(403).json({
        success: false,
        error: "Access denied - SuperAdmin only",
      });
    }

    const { username, email, password, name, role = "admin" } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "User with this email or username already exists",
      });
    }

    // Only allow creating admin users (SuperAdmin creates other admins)
    if (role !== "admin") {
      return res.status(400).json({
        success: false,
        error: "Can only create admin users",
      });
    }

    // Create user (password will be hashed by User model's pre('save') middleware)
    const user = new User({
      username,
      email,
      password, // Don't hash here - let the model handle it
      name,
      role,
      isActive: true,
      createdBy: req.user.id,
    });

    await user.save();

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      data: { user: userResponse },
      message: "Admin user created successfully",
    });
  } catch (error) {
    console.error("Error creating user:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to create user",
    });
  }
};

/**
 * Update user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { password, role, ...updateData } = req.body;

    // Find user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Handle different update scenarios
    if (req.userRole === "admin") {
      // Admin can only update their own profile
      if (id !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          error: "Access denied - You can only update your own profile",
        });
      }

      // Admin cannot change their own role
      if (role) {
        return res.status(403).json({
          success: false,
          error: "You cannot change your own role",
        });
      }
    } else if (req.userRole === "SuperAdmin") {
      // Check if trying to update another SuperAdmin
      if (user.role === "SuperAdmin" && id !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          error: "Cannot modify other SuperAdmin users",
        });
      }

      // SuperAdmin cannot change their own role or any SuperAdmin role
      if (user.role === "SuperAdmin" && role) {
        return res.status(403).json({
          success: false,
          error: "Cannot change SuperAdmin role",
        });
      }

      // For admin users, handle role update (only allow admin role)
      if (user.role === "admin" && role && role !== "admin") {
        return res.status(400).json({
          success: false,
          error: "Can only set role to admin",
        });
      }
      if (user.role === "admin" && role) updateData.role = role;
    }

    // Handle password update (let User model's pre('save') middleware handle hashing)
    if (password) {
      updateData.password = password; // Don't hash here - let the model handle it
    }

    // Update user - use save() to trigger pre('save') middleware for password hashing
    Object.assign(user, updateData);
    user.updatedAt = new Date();
    await user.save();

    // Get updated user without password
    const updatedUser = await User.findById(id).select("-password");

    res.status(200).json({
      success: true,
      data: { user: updatedUser },
      message: "User updated successfully",
    });
  } catch (error) {
    console.error("Error updating user:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to update user",
    });
  }
};

/**
 * Delete user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Find user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Prevent deleting SuperAdmin
    if (user.role === "SuperAdmin") {
      return res.status(403).json({
        success: false,
        error: "Cannot delete SuperAdmin user",
      });
    }

    // Handle different deletion scenarios
    if (req.userRole === "admin") {
      // Admin can only delete their own account
      if (id !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          error: "Access denied - You can only delete your own account",
        });
      }
    } else if (req.userRole === "SuperAdmin") {
      // SuperAdmin cannot delete themselves
      if (user._id.toString() === req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          error: "SuperAdmin cannot delete their own account",
        });
      }
    }

    // Delete user
    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete user",
    });
  }
};

module.exports = {
  getUserStats,
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
};
