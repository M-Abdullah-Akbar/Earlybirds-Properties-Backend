const express = require("express");
const router = express.Router();
const {
  getBlogs,
  getBlog,
  createBlogWithImages,
  updateBlog,
  deleteBlog,
  deleteBlogImage,
} = require("../controllers/blogController");

// Import middleware
const { auth } = require("../middleware/auth");
const optionalAuth = require("../middleware/optionalAuth");
const { checkPermission } = require("../middleware/acl");
const {
  parseMultipartData,
  processValidatedImages,
} = require("../middleware/imageUpload");
const {
  createBlogValidation,
  updateBlogValidation,
  blogQueryValidation,
  singleBlogValidation,
  parseEnhancedFormData,
} = require("../middleware/validation");

/**
 * @route   DELETE /api/blogs/:id/images/:imageId
 * @desc    Delete specific image from blog
 * @access  Admin only
 */
router.delete(
  "/:id/images/:imageId",
  auth,
  checkPermission("blogs", "Update"),
  deleteBlogImage
);

/**
 * @route   GET /api/blogs
 * @desc    Get all blogs with filtering and pagination
 * @access  Public (visitors see published only) / Admin (sees all)
 */
router.get("/", optionalAuth, checkPermission("blogs", "Read"), getBlogs);

/**
 * @route   POST /api/blogs/with-images
 * @desc    Create blog with file uploads (handles both form data and images)
 * @access  Admin only
 */
router.post(
  "/with-images",
  auth,
  checkPermission("blogs", "Create"),
  parseMultipartData,
  parseEnhancedFormData,
  createBlogValidation,
  processValidatedImages,
  createBlogWithImages
);

router
  .route("/:id")
  /**
   * @route   GET /api/blogs/:id
   * @desc    Get single blog by ID or slug
   * @access  Public (visitors see published only) / Admin (sees all)
   */
  .get(optionalAuth, checkPermission("blogs", "Read"), getBlog)
  /**
   * @route   PUT /api/blogs/:id
   * @desc    Update blog (handles both form data and images, same as create)
   * @access  Admin only
   */
  .put(
    auth,
    checkPermission("blogs", "Update"),
    parseMultipartData,
    parseEnhancedFormData,
    updateBlogValidation,
    processValidatedImages,
    updateBlog
  )
  /**
   * @route   DELETE /api/blogs/:id
   * @desc    Delete blog
   * @access  Admin only
   */
  .delete(auth, checkPermission("blogs", "Delete"), deleteBlog);

module.exports = router;
