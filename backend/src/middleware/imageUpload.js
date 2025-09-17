/**
 * Image Upload Middleware
 * Handles property image uploads with error handling using local storage
 */

const {
  uploadPropertyImages, // Now uses smart compression
  uploadSmartCompressedImages,
} = require("../config/localUpload");
const multer = require("multer");

// Create memory storage for parsing form data without saving files
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 11 * 1024 * 1024, // 11MB limit per file
    files: 10, // Max 10 files
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

/**
 * Middleware to parse multipart form data without saving files
 * This allows us to validate form fields before processing images
 */
const parseMultipartData = (req, res, next) => {
  const upload = memoryUpload.array("images", 10);

  upload(req, res, (error) => {
    if (error) {
      console.error("Form data parsing error:", error);

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

      // Generic parsing error
      return res.status(500).json({
        success: false,
        error: "Form data parsing failed. Please try again.",
      });
    }

    // Store the parsed files in memory for later processing
    if (req.files && req.files.length > 0) {
      req.pendingImages = req.files; // Store files for later processing
      console.log(
        `📋 Parsed ${req.files.length} image(s) in memory (not saved yet)`
      );
    }

    next();
  });
};

/**
 * Middleware to handle property image uploads
 * Supports multiple images with proper error handling
 */
const handlePropertyImageUpload = (req, res, next) => {
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

    if (req.files && req.files.length > 0) {
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
 * Middleware to process images from memory after validation passes
 * This processes the images that were parsed earlier by parseMultipartData
 */
const processValidatedImages = async (req, res, next) => {
  // If no pending images, continue
  if (!req.pendingImages || req.pendingImages.length === 0) {
    console.log("📋 No images to process");
    return next();
  }

  try {
    console.log(
      `🔄 Processing ${req.pendingImages.length} validated image(s)...`
    );

    // Import the image processing functions
    const {
      processImage,
      validateImage,
      getImageMetadata,
    } = require("../config/imageProcessor");
    const path = require("path");
    const fs = require("fs").promises;

    // Determine upload directory - store directly in uploads folder
    const uploadDir =
      process.env.NODE_ENV === "production"
        ? path.join(__dirname, "../uploads")
        : path.join(__dirname, "../uploads");

    // Ensure directory exists
    await fs.mkdir(uploadDir, { recursive: true });

    const processedImages = [];

    for (let i = 0; i < req.pendingImages.length; i++) {
      const file = req.pendingImages[i];

      try {
        // Validate the image
        await validateImage(file.buffer, file.originalname);

        // Get original image metadata
        const originalMetadata = await getImageMetadata(file.buffer);

        // Generate unique filename
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        const filename = `${timestamp}-${randomString}.webp`;
        const filepath = path.join(uploadDir, filename);

        // Process the image buffer
        const processedBuffer = await processImage(file.buffer, {
          quality: 85,
          format: "webp",
        });

        // Save the processed buffer to disk
        await fs.writeFile(filepath, processedBuffer);

        // Get the file size after processing
        const stats = await fs.stat(filepath);
        const result = {
          size: stats.size,
          compressed: true,
          quality: 85,
          width: originalMetadata.width,
          height: originalMetadata.height,
        };

        // Get image metadata if available
        const metadata =
          req.imageMetadata && req.imageMetadata[i] ? req.imageMetadata[i] : {};

        // Generate full URL with BASE_URL - store directly in uploads folder
        const baseUrl = process.env.BASE_URL || "http://localhost:8000";
        const fullImageUrl = `${baseUrl}/uploads/${filename}`;

        // Create the processed image object
        const processedImage = {
          url: fullImageUrl,
          publicId: filename, // Use just the filename, not the full path
          originalName: file.originalname,
          size: result.size,
          originalSize: file.size,
          compressionRatio: Math.round(
            ((file.size - result.size) / file.size) * 100
          ),
          format: "webp",
          width: result.width,
          height: result.height,
          compressed: result.compressed || false,
          quality: result.quality || 85,
          compressionApplied: result.compressed || false,
          // Add metadata from form data
          altText: metadata.altText || `Property image ${i + 1}`,
          order: metadata.order !== undefined ? parseInt(metadata.order) : i,
          isMain:
            metadata.isMain === "true" ||
            metadata.isMain === true ||
            (i === 0 &&
              !req.imageMetadata?.some(
                (m) => m.isMain === "true" || m.isMain === true
              )),
        };

        processedImages.push(processedImage);

        console.log(
          `✅ Processed image ${i + 1}: ${file.originalname} → ${filename}`
        );
      } catch (imageError) {
        console.error(`❌ Failed to process image ${i + 1}:`, imageError);
        return res.status(400).json({
          success: false,
          error: `Failed to process image "${file.originalname}": ${imageError.message}`,
        });
      }
    }

    // Set the processed images on the request
    req.uploadedImages = processedImages;
    req.files = processedImages.map((img) => ({
      location: img.url,
      key: img.publicId, // This is now just the filename
      originalname: img.originalName,
      size: img.size,
      originalSize: img.originalSize,
      compressionRatio: img.compressionRatio,
      format: img.format,
      width: img.width,
      height: img.height,
      compressed: img.compressed,
      quality: img.quality,
      compressionApplied: img.compressionApplied,
    }));

    // Log compression stats
    processedImages.forEach((img, index) => {
      const action = img.compressionApplied ? "COMPRESSED" : "AS-IS";
      console.log(
        `📊 Image ${index + 1} [${action}]: ${img.originalSize} → ${
          img.size
        } bytes (${img.compressionRatio}% reduction, quality: ${img.quality}%)`
      );
    });

    // Clean up pending images
    delete req.pendingImages;

    next();
  } catch (error) {
    console.error("❌ Image processing error:", error);
    return res.status(500).json({
      success: false,
      error: "Image processing failed. Please try again.",
    });
  }
};

/**
 * Middleware to handle smart compressed image uploads (100KB threshold)
 * Supports multiple images with proper error handling (no timeout)
 */
const handleSmartCompressedImageUpload = (req, res, next) => {
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

    if (req.files && req.files.length > 0) {
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
    }

    next();
  });
};

module.exports = {
  handlePropertyImageUpload,
  handleSmartCompressedImageUpload,
  optionalImages,
  parseMultipartData,
  processValidatedImages,
};
