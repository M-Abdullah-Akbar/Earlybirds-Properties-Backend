/**
 * Blog Category Approval Routes (SuperAdmin Only)
 * Handles blog category approval/rejection workflow
 */

const express = require("express");
const router = express.Router();

// Import controllers
const {
  getPendingCategories,
  approveCategory,
  rejectCategory,
  getApprovalStats,
} = require("../controllers/blogCategoryApprovalController");

// Import middleware
const { auth } = require("../middleware/auth");
const { checkPermission } = require("../middleware/acl");
const {
  validateCategoryId,
  validateRejection,
} = require("../middleware/validation");

/**
 * @route   GET /api/blog-category-approval/pending
 * @desc    Get blog categories pending approval
 * @access  SuperAdmin only
 */
router.get(
  "/pending",
  auth,
  checkPermission("blogCategories", "Read"),
  getPendingCategories
);

/**
 * @route   GET /api/blog-category-approval/stats
 * @desc    Get approval statistics
 * @access  SuperAdmin only
 */
router.get(
  "/stats",
  auth,
  checkPermission("blogCategories", "Approve"),
  getApprovalStats
);

/**
 * @route   PATCH /api/blog-category-approval/:id/approve
 * @desc    Approve a blog category
 * @access  SuperAdmin only
 */
router.patch(
  "/:id/approve",
  auth,
  checkPermission("blogCategories", "Approve"),
  validateCategoryId,
  approveCategory
);

/**
 * @route   PATCH /api/blog-category-approval/:id/reject
 * @desc    Reject a blog category
 * @access  SuperAdmin only
 */
router.patch(
  "/:id/reject",
  auth,
  checkPermission("blogCategories", "Approve"),
  validateCategoryId,
  validateRejection,
  rejectCategory
);

module.exports = router;
