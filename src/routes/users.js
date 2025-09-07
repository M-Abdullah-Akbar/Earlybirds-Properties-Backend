/**
 * User Management Routes (SuperAdmin Only)
 * Handles CRUD operations for user management
 */

const express = require("express");
const router = express.Router();

// Import controllers
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  getUserStats,
} = require("../controllers/usersController");

// Import middleware
const { auth } = require("../middleware/auth");
const { checkPermission } = require("../middleware/acl");
const {
  createUserValidation,
  updateUserValidation,
  userQueryValidation,
  singleUserValidation,
} = require("../middleware/validation");

/**
 * @route   GET /api/users/stats
 * @desc    Get user statistics (SuperAdmin only)
 * @access  SuperAdmin only
 */
router.get("/stats", auth, checkPermission("users", "Read"), getUserStats);

router
  .route("/")
  /**
   * @route   GET /api/users
   * @desc    Get all users with filtering and pagination
   * @access  SuperAdmin only
   */
  .get(auth, checkPermission("users", "Read"), userQueryValidation, getUsers)
  /**
   * @route   POST /api/users
   * @desc    Create new user (admin)
   * @access  SuperAdmin only
   */
  .post(
    auth,
    checkPermission("users", "Create"),
    createUserValidation,
    createUser
  );

router
  .route("/:id")
  /**
   * @route   GET /api/users/:id
   * @desc    Get single user by ID
   * @access  SuperAdmin only
   */
  .get(auth, checkPermission("users", "Read"), singleUserValidation, getUser)
  /**
   * @route   PUT /api/users/:id
   * @desc    Update user
   * @access  SuperAdmin only
   */
  .put(
    auth,
    checkPermission("users", "Update"),
    updateUserValidation,
    updateUser
  )
  /**
   * @route   DELETE /api/users/:id
   * @desc    Delete user
   * @access  SuperAdmin only
   */
  .delete(
    auth,
    checkPermission("users", "Delete"),
    singleUserValidation,
    deleteUser
  );

module.exports = router;
