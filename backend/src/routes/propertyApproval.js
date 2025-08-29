/**
 * Property Approval Routes (SuperAdmin Only)
 * Handles property approval/rejection workflow
 */

const express = require("express");
const router = express.Router();

// Import controllers
const {
  getPendingProperties,
  approveProperty,
  rejectProperty,
  getApprovalStats,
} = require("../controllers/propertyApprovalController");

// Import middleware
const { auth } = require("../middleware/auth");
const { checkPermission } = require("../middleware/acl");
const {
  validatePropertyId,
  validateRejection,
} = require("../middleware/validation");

/**
 * @route   GET /api/property-approval/pending
 * @desc    Get properties pending approval
 * @access  SuperAdmin only
 */
router.get(
  "/pending",
  auth,
  checkPermission("properties", "Read"),
  getPendingProperties
);

/**
 * @route   GET /api/property-approval/stats
 * @desc    Get approval statistics
 * @access  SuperAdmin only
 */
router.get(
  "/stats",
  auth,
  checkPermission("properties", "Approve"),
  getApprovalStats
);

/**
 * @route   PATCH /api/property-approval/:id/approve
 * @desc    Approve a property
 * @access  SuperAdmin only
 */
router.patch(
  "/:id/approve",
  auth,
  checkPermission("properties", "Approve"),
  validatePropertyId,
  approveProperty
);

/**
 * @route   PATCH /api/property-approval/:id/reject
 * @desc    Reject a property
 * @access  SuperAdmin only
 */
router.patch(
  "/:id/reject",
  auth,
  checkPermission("properties", "Approve"),
  validatePropertyId,
  validateRejection,
  rejectProperty
);

module.exports = router;
