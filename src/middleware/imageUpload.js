/**
 * Image Upload Middleware
 * Handles property image uploads with error handling using local storage
 */

const {
  uploadPropertyImages, // Now uses smart compression
  uploadSmartCompressedImages,
} = require("../config/localUpload");

/**
 * Middleware to handle property image uploads
 * Supports multiple images with proper error handling
 */
const handlePropertyImageUpload = (req, res, next) => {
  console.log("🔍 handlePropertyImageUpload middleware called");
  const upload = uploadPropertyImages.array("images", 10); // Max 10 images

  upload(req, res, (error) => {
    if (error) {
      console.error("Image upload error:", error);

      // Handle specific multer errors
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          error: "File too large. Maximum size is 11MB per image.",
        });
      }

      if (error.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({
          success: false,
          error: "Too many files. Maximum 10 images allowed per property.",
        });
      }

      if (error.message === "Only image files are allowed!") {
        return res.status(400).json({
          success: false,
          error: "Only image files (JPG, JPEG, PNG, WebP) are allowed.",
        });
      }

      // Generic upload error
      return res.status(500).json({
        success: false,
        error: "Image upload failed. Please try again.",
      });
    }

    // Process uploaded files
    console.log("🔍 req.files:", req.files ? req.files.length : "undefined");
    console.log("🔍 req.body keys:", Object.keys(req.body));
    console.log("🔍 req.body:", JSON.stringify(req.body, null, 2));

    if (req.files && req.files.length > 0) {
      console.log("🔍 Processing", req.files.length, "uploaded files");
      req.uploadedImages = req.files.map((file) => ({
        url: file.location, // Local URL
        publicId: file.key, // File path (used as publicId for compatibility)
        originalName: file.originalname,
        size: file.size, // Final compressed size
        originalSize: file.originalSize, // Original size before compression
        compressionRatio: file.compressionRatio, // Compression percentage
        format: "webp", // Always WebP format
        width: file.width, // Original width (preserved)
        height: file.height, // Original height (preserved)
        compressed: file.compressionApplied, // Whether compression was applied
        quality: file.quality, // Final quality used
        compressionApplied: file.compressionApplied, // Compression status
        // Include processed images data for compatibility
        processedImages: file.processedImages || null,
      }));
      console.log("🔍 req.uploadedImages created:", req.uploadedImages.length);

      // Log compression stats
      req.uploadedImages.forEach((img, index) => {
        const action = img.compressionApplied ? "COMPRESSED" : "AS-IS";
        console.log(
          `📊 Image ${index + 1} [${action}]: ${img.originalSize} → ${
            img.size
          } bytes (${img.compressionRatio}% reduction, quality: ${
            img.quality
          }%)`
        );
      });
    } else {
      console.log("🔍 No files uploaded or req.files is empty");
    }

    next();
  });
};

/**
 * Middleware to make images optional
 */
const optionalImages = (req, res, next) => {
  // Images are optional, just continue
  next();
};

/**
 * Middleware to handle smart compressed image uploads (100KB threshold)
 * Supports multiple images with proper error handling (no timeout)
 */
const handleSmartCompressedImageUpload = (req, res, next) => {
  console.log("🔍 handleSmartCompressedImageUpload middleware called");
  const upload = uploadSmartCompressedImages.array("images", 10); // Max 10 images

  upload(req, res, (error) => {
    if (error) {
      console.error("Smart compression upload error:", error);

      // Handle specific multer errors
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          error: "File too large. Maximum size is 11MB per image.",
        });
      }

      if (error.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({
          success: false,
          error: "Too many files. Maximum 10 images allowed per upload.",
        });
      }

      if (error.message === "Only image files are allowed!") {
        return res.status(400).json({
          success: false,
          error: "Only image files (JPG, JPEG, PNG, WebP) are allowed.",
        });
      }

      // Generic upload error
      return res.status(500).json({
        success: false,
        error: "Smart compression upload failed. Please try again.",
      });
    }

    // Process uploaded files
    console.log("🔍 req.files:", req.files ? req.files.length : "undefined");

    if (req.files && req.files.length > 0) {
      console.log("🔍 Processing", req.files.length, "smart compressed files");
      req.uploadedImages = req.files.map((file) => ({
        url: file.location, // Local URL
        publicId: file.key, // File path (used as publicId for compatibility)
        originalName: file.originalname,
        size: file.size, // Final compressed size
        originalSize: file.originalSize, // Original size before compression
        compressionRatio: file.compressionRatio, // Compression percentage
        format: "webp", // Always WebP format
        width: file.width, // Original width (preserved)
        height: file.height, // Original height (preserved)
        compressed: file.compressionApplied, // Whether compression was applied
        quality: file.quality, // Final quality used
        compressionApplied: file.compressionApplied, // Compression status
        // Include processed images data for compatibility
        processedImages: file.processedImages || null,
      }));
      console.log("🔍 req.uploadedImages created:", req.uploadedImages.length);

      // Log compression stats
      req.uploadedImages.forEach((img, index) => {
        const action = img.compressionApplied ? "COMPRESSED" : "AS-IS";
        console.log(
          `📊 Image ${index + 1} [${action}]: ${img.originalSize} → ${
            img.size
          } bytes (${img.compressionRatio}% reduction, quality: ${
            img.quality
          }%)`
        );
      });
    } else {
      console.log("🔍 No files uploaded or req.files is empty");
    }

    next();
  });
};

module.exports = {
  handlePropertyImageUpload,
  handleSmartCompressedImageUpload,
  optionalImages,
};
