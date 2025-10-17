const express = require("express");
const router = express.Router();
const {
  getAreasForEmirate,
  getAmenitiesForPropertyType,
  getAvailablePropertyTypes,
  getProperties,
  getProperty,
  createPropertyWithImages,
  updateProperty,
  deleteProperty,
  deletePropertyImage,
  setMainPropertyImage,
} = require("../controllers/propertiesController");

// Import middleware
const { auth } = require("../middleware/auth");
const optionalAuth = require("../middleware/optionalAuth");
const { checkPermission } = require("../middleware/acl");
const {
  handlePropertyImageUpload,
  handleSmartCompressedImageUpload,
  optionalImages,
  parseMultipartData,
  processValidatedImages,
} = require("../middleware/imageUpload");
const {
  // Validation middleware removed - backend validations disabled
  // createPropertyWithImagesValidation,
  // updatePropertyValidation,
  // propertyQueryValidation,
  // singlePropertyValidation,
  parseFormDataOnly,
  parsePropertyDataFromFormData,
  parseEnhancedFormData,
  validateFocusKeywordUniqueness,
} = require("../middleware/validation");

/**
 * @route   GET /api/properties/property-types
 * @desc    Get all predefined property types (for admin property management)
 * @access  Admin Only
 */
router.get("/property-types", auth, getAvailablePropertyTypes);

/**
 * @route   GET /api/properties/amenities/:propertyType
 * @desc    Get valid amenities for a specific property type (for admin property management)
 * @access  Admin only
 */
router.get("/amenities/:propertyType", auth, getAmenitiesForPropertyType);

/**
 * @route   GET /api/properties/areas/:emirate
 * @desc    Get valid areas for a specific emirate (for admin property management)
 * @access  Admin only
 */
router.get("/areas/:emirate", auth, getAreasForEmirate);

/**
 * @route   DELETE /api/properties/:id/images/:imageId
 * @desc    Delete specific image from property
 * @access  Admin only
 */
router.delete(
  "/:id/images/:imageId",
  auth,
  checkPermission("properties", "Update"),
  deletePropertyImage
);

/**
 * @route   PUT /api/properties/:id/images/:imageId/main
 * @desc    Set image as main property image
 * @access  Admin only
 */
router.put(
  "/:id/images/:imageId/main",
  auth,
  checkPermission("properties", "Update"),
  setMainPropertyImage
);

/**
 * @route   GET /api/properties
 * @desc    Get all properties with filtering and pagination
 * @access  Public (visitors see published only) / Admin (sees all)
 */
router.get(
  "/",
  optionalAuth,
  checkPermission("properties", "Read"),
  // propertyQueryValidation, // Validation disabled
  getProperties
);

/**
 * @route   POST /api/properties
 * @desc    Create property with file uploads (handles both form data and images)
 * @access  Admin only
 */
router.post(
  "/",
  auth,
  checkPermission("properties", "Create"),
  parseMultipartData,
  parseEnhancedFormData,
  validateFocusKeywordUniqueness,
  // createPropertyWithImagesValidation, // Validation disabled
  processValidatedImages,
  createPropertyWithImages
);

router
  .route("/:id")
  /**
   * @route   GET /api/properties/:id
   * @desc    Get single property by ID or slug
   * @access  Public (visitors see published only) / Admin (sees all)
   */
  .get(
    optionalAuth,
    checkPermission("properties", "Read"),
    // singlePropertyValidation, // Validation disabled
    getProperty
  )
  /**
   * @route   PUT /api/properties/:id
   * @desc    Update property (handles both form data and images, same as create)
   * @access  Admin only
   */
  .put(
    auth,
    checkPermission("properties", "Update"),
    parseMultipartData,
    parseEnhancedFormData,
    validateFocusKeywordUniqueness,
    // updatePropertyValidation, // Validation disabled
    processValidatedImages,
    updateProperty
  )
  /**
   * @route   DELETE /api/properties/:id
   * @desc    Delete property
   * @access  Admin only
   */
  .delete(
    auth,
    checkPermission("properties", "Delete"),
    // singlePropertyValidation, // Validation disabled
    deleteProperty
  );

module.exports = router;
