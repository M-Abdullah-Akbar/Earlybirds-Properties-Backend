const express = require("express");
const router = express.Router();
const {
  getBlogs,
  getBlog,
  createBlog,
  createBlogWithImages,
  updateBlogSimple,
  updateBlog,
  deleteBlog,
  deleteBlogImage,
  setMainBlogImage,
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
  // Re-enabled validation middleware for blog creation
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
  singleBlogValidation,
  deleteBlogImage
);

/**
 * @route   PUT /api/blogs/:id/images/:imageId/main
 * @desc    Set image as main blog image
 * @access  Admin only
 */
router.put(
  "/:id/images/:imageId/main",
  auth,
  checkPermission("blogs", "Update"),
  singleBlogValidation,
  setMainBlogImage
);

/**
 * @route   GET /api/blogs
 * @desc    Get all blogs with filtering and pagination
 * @access  Public (visitors see published only) / Admin (sees all)
 */
router.get("/", optionalAuth, checkPermission("blogs", "Read"), blogQueryValidation, getBlogs);

/**
 * @route   POST /api/blogs
 * @desc    Create blog (simple JSON)
 * @access  Admin only
 */
router.post("/", auth, checkPermission("blogs", "Create"), createBlogValidation, createBlog);

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
  .get(optionalAuth, checkPermission("blogs", "Read"), singleBlogValidation, getBlog)
  /**
   * @route   PUT /api/blogs/:id
   * @desc    Update blog (simple JSON)
   * @access  Admin only
   */
  .put(auth, checkPermission("blogs", "Update"), updateBlogValidation, updateBlogSimple)
  /**
   * @route   DELETE /api/blogs/:id
   * @desc    Delete blog
   * @access  Admin only
   */
  .delete(auth, checkPermission("blogs", "Delete"), singleBlogValidation, deleteBlog);

/**
 * @route   PUT /api/blogs/:id/with-images
 * @desc    Update blog (handles both form data and images, same as create)
 * @access  Admin only
 */
router.put(
  "/:id/with-images",
  auth,
  checkPermission("blogs", "Update"),
  parseMultipartData,
  parseEnhancedFormData,
  updateBlogValidation,
  processValidatedImages,
  updateBlog
);

module.exports = router;
