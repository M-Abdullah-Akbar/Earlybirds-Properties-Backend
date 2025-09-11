const express = require("express");
const router = express.Router();
const {
  getBlogCategories,
  getBlogCategory,
  createBlogCategory,
  updateBlogCategory,
  deleteBlogCategory,
} = require("../controllers/blogCategoryController");

// Import middleware
const { auth } = require("../middleware/auth");
const optionalAuth = require("../middleware/optionalAuth");
const { checkPermission } = require("../middleware/acl");
const {
  createBlogCategoryValidation,
  updateBlogCategoryValidation,
  blogCategoryQueryValidation,
  singleBlogCategoryValidation,
} = require("../middleware/validation");

/**
 * @route   GET /api/blog-categories
 * @desc    Get all blog categories with filtering and pagination
 * @access  Public
 */
router.get(
  "/",
  optionalAuth,
  checkPermission("blogCategories", "Read"),
  getBlogCategories
);

/**
 * @route   POST /api/blog-categories
 * @desc    Create new blog category
 * @access  Admin only
 */
router.post(
  "/",
  auth,
  checkPermission("blogCategories", "Create"),
  createBlogCategoryValidation,
  createBlogCategory
);

router
  .route("/:id")
  /**
   * @route   GET /api/blog-categories/:id
   * @desc    Get single blog category by ID or slug
   * @access  Public
   */
  .get(optionalAuth, checkPermission("blogCategories", "Read"), getBlogCategory)
  /**
   * @route   PUT /api/blog-categories/:id
   * @desc    Update blog category
   * @access  Admin only
   */
  .put(
    auth,
    checkPermission("blogCategories", "Update"),
    updateBlogCategoryValidation,
    updateBlogCategory
  )
  /**
   * @route   DELETE /api/blog-categories/:id
   * @desc    Delete blog category
   * @access  Admin only
   */
  .delete(
    auth,
    checkPermission("blogCategories", "Delete"),
    deleteBlogCategory
  );

module.exports = router;
