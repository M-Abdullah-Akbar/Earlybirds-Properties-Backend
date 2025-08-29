/**
 * User Management Controller (SuperAdmin Only)
 * Handles CRUD operations for user management
 */

const User = require("../models/User");
const Property = require("../models/Property");

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

    // Get only the stats that are used in the frontend
    const [totalUsers, superAdminCount, activeUsers] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "SuperAdmin" }),
      User.countDocuments({ isActive: true }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        total: totalUsers,
        byRole: {
          SuperAdmin: superAdminCount,
        },
        byStatus: {
          active: activeUsers,
        },
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

    const { page = 1, limit = 10, isActive, search } = req.query;

    // Start with ACL query filters (SuperAdmin can see all)
    const filter = { ...req.queryFilters } || {};

    // Apply additional filters
    if (isActive !== undefined) filter.isActive = isActive === "true";

    // Search functionality
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Use default sort (createdAt desc) since frontend doesn't provide sorting options
    const sort = { createdAt: -1 };

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("_id name email username role isActive createdAt lastLogin") // Only select fields used in frontend
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

    const user = await User.findById(id).select(
      "_id name email username role isActive createdAt lastLogin"
    );

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
    // Note: confirmPassword is used only for validation, not stored in database

    // Only allow creating admin and SuperAdmin users
    if (role !== "admin" && role !== "SuperAdmin") {
      return res.status(400).json({
        success: false,
        error: "Can only create admin or SuperAdmin users",
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

    // Save without updating the updatedAt timestamp
    await user.save({ timestamps: { updatedAt: false } });

    // Get user with only necessary fields for response
    const userResponse = await User.findById(user._id).select(
      "_id name email username role isActive createdAt lastLogin"
    );

    res.status(201).json({
      success: true,
      data: { user: userResponse },
      message: `${role} user created successfully`,
    });
  } catch (error) {
    console.error("Error creating user:", error);

    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const value = error.keyValue[field];
      return res.status(400).json({
        success: false,
        error: `User with this ${field} already exists`,
        details: [
          {
            field: field,
            message: `${
              field.charAt(0).toUpperCase() + field.slice(1)
            } already exists`,
          },
        ],
      });
    }

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
 * Update user profile (basic fields only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body; // Only contains name, username, email

    // Find user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Users can only update their own profile
    if (id !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        error: "Access denied - You can only update your own profile",
      });
    }

    // Update user with only allowed profile fields (whitelist approach)
    const allowedFields = ["name", "username", "email"];
    const filteredUpdateData = {};

    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        filteredUpdateData[field] = updateData[field];
      }
    });

    Object.assign(user, filteredUpdateData);
    user.updatedAt = new Date();
    await user.save();

    // Get updated user with only necessary fields for response
    const updatedUser = await User.findById(id).select(
      "_id name email username role isActive"
    );

    res.status(200).json({
      success: true,
      data: { user: updatedUser },
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Error updating user profile:", error);

    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const value = error.keyValue[field];
      return res.status(400).json({
        success: false,
        error: `User with this ${field} already exists`,
        details: [
          {
            field: field,
            message: `${
              field.charAt(0).toUpperCase() + field.slice(1)
            } already exists`,
          },
        ],
      });
    }

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
      error: "Failed to update profile",
    });
  }
};

/**
 * Transfer property ownership (SuperAdmin only)
 * @route PATCH /api/users/:id/transfer-properties
 * @access SuperAdmin only
 */
const transferPropertyOwnership = async (req, res) => {
  try {
    const { id } = req.params; // Current owner ID
    const { newOwnerId, propertyIds } = req.body; // New owner ID and optional specific property IDs

    // Only SuperAdmin can transfer property ownership
    if (req.userRole !== "SuperAdmin") {
      return res.status(403).json({
        success: false,
        error:
          "Access denied - Only SuperAdmin can transfer property ownership",
      });
    }

    // Validate new owner
    const newOwner = await User.findById(newOwnerId);
    if (!newOwner) {
      return res.status(404).json({
        success: false,
        error: "New owner not found",
      });
    }

    // Validate current owner
    const currentOwner = await User.findById(id);
    if (!currentOwner) {
      return res.status(404).json({
        success: false,
        error: "Current owner not found",
      });
    }

    // Build query for properties to transfer
    let propertyQuery = { createdBy: id };

    // If specific property IDs are provided, only transfer those
    if (propertyIds && Array.isArray(propertyIds) && propertyIds.length > 0) {
      propertyQuery._id = { $in: propertyIds };
    } else {
      // Transfer only approved and pending properties (not rejected ones)
      propertyQuery.approvalStatus = { $in: ["approved", "pending"] };
    }

    // Get properties to be transferred
    const propertiesToTransfer = await Property.find(propertyQuery);

    if (propertiesToTransfer.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No properties found to transfer",
      });
    }

    // Transfer ownership
    const transferResult = await Property.updateMany(propertyQuery, {
      $set: {
        createdBy: newOwnerId,
        updatedBy: req.user.id,
        updatedAt: new Date(),
      },
    });

    res.status(200).json({
      success: true,
      message: `Successfully transferred ${transferResult.modifiedCount} property(ies) from ${currentOwner.name} to ${newOwner.name}`,
      data: {
        transferredCount: transferResult.modifiedCount,
        fromUser: {
          id: currentOwner._id,
          name: currentOwner.name,
          email: currentOwner.email,
        },
        toUser: {
          id: newOwner._id,
          name: newOwner.name,
          email: newOwner.email,
        },
      },
    });
  } catch (error) {
    console.error("Error transferring property ownership:", error);
    res.status(500).json({
      success: false,
      error: "Failed to transfer property ownership",
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

      // Check if user has approved or pending properties
      const userProperties = await Property.find({
        createdBy: id,
        approvalStatus: { $in: ["approved", "pending"] },
      });

      if (userProperties.length > 0) {
        return res.status(400).json({
          success: false,
          error: "Cannot delete user with approved or pending properties",
          details: {
            propertyCount: userProperties.length,
            message:
              "Please transfer property ownership before deleting this user",
            properties: userProperties.map((p) => ({
              id: p._id,
              title: p.title,
              approvalStatus: p.approvalStatus,
            })),
          },
        });
      }
    }

    // Delete user (only rejected properties will remain, which is acceptable)
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

/**
 * Update user status (active/inactive) - SuperAdmin only
 * @route PATCH /api/users/:id/status
 * @access SuperAdmin only
 */
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    // Validate isActive field
    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        error: "isActive field must be a boolean value",
      });
    }

    // Find user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Only SuperAdmin can update user status
    if (req.userRole !== "SuperAdmin") {
      return res.status(403).json({
        success: false,
        error: "Access denied - Only SuperAdmin can update user status",
      });
    }

    // SuperAdmin cannot change their own status
    if (user._id.toString() === req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        error: "SuperAdmin cannot change their own status",
      });
    }

    // SuperAdmin cannot change other SuperAdmin status
    if (user.role === "SuperAdmin") {
      return res.status(403).json({
        success: false,
        error: "Cannot change status of other SuperAdmin users",
      });
    }

    // Update only the isActive field
    user.isActive = isActive;
    user.updatedAt = new Date();
    await user.save();

    // Get updated user with only necessary fields
    const updatedUser = await User.findById(id).select(
      "_id name email username role isActive createdAt lastLogin"
    );

    res.status(200).json({
      success: true,
      data: { user: updatedUser },
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
    });
  } catch (error) {
    console.error("Error updating user status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update user status",
    });
  }
};

module.exports = {
  getUserStats,
  getUsers,
  getUser,
  createUser,
  updateUser,
  updateUserStatus,
  deleteUser,
  transferPropertyOwnership,
};
