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
      `🔄 Processing ${req.pendingImages.length} validated image(s) with SMART COMPRESSION...`
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
        console.log(
          `\n🖼️  === PROCESSING IMAGE ${i + 1}/${req.pendingImages.length}: ${
            file.originalname
          } ===`
        );

        // Validate the image
        await validateImage(file.buffer, file.originalname);
        console.log(`✅ Image validation passed for: ${file.originalname}`);

        // Get original image metadata
        const originalMetadata = await getImageMetadata(file.buffer);
        const originalSize = file.size;
        const originalSizeKB = Math.round(originalSize / 1024);
        const megapixels =
          (originalMetadata.width * originalMetadata.height) / (1024 * 1024);

        console.log(
          `📊 Original size: ${originalSize} bytes (${originalSizeKB}KB)`
        );
        console.log(
          `📐 Original dimensions: ${originalMetadata.width}x${
            originalMetadata.height
          } (${Math.round(megapixels * 10) / 10}MP)`
        );

        // Generate unique filename
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        const filename = `${timestamp}-${randomString}.webp`;
        const filepath = path.join(uploadDir, filename);

        // Smart compression logic based on 100KB threshold
        const targetSizeBytes = 100 * 1024; // 100KB
        const targetSizeKB = 100;
        let processedBuffer;
        let finalSize;
        let compressionApplied = false;
        let finalQuality = 100;

        if (originalSize > targetSizeBytes) {
          console.log(
            `🎯 Starting SMART COMPRESSION: target ≤${targetSizeKB}KB (current: ${originalSizeKB}KB)`
          );

          // Predict optimal quality based on image characteristics
          const compressionRatio = targetSizeBytes / originalSize;
          let predictedQuality;

          // Enhanced prediction algorithm
          if (compressionRatio < 0.1) {
            predictedQuality = 1;
            console.log(
              `🔥 Extreme compression needed (>90% reduction) → Starting at 1% quality`
            );
          } else if (megapixels > 20) {
            predictedQuality = Math.max(
              1,
              Math.round(compressionRatio * 100 * 0.3)
            );
            console.log(
              `📸 Very high resolution (${
                Math.round(megapixels * 10) / 10
              }MP) → Predicted quality: ${predictedQuality}%`
            );
          } else if (megapixels > 10) {
            predictedQuality = Math.max(
              1,
              Math.round(compressionRatio * 100 * 0.5)
            );
            console.log(
              `📸 High resolution (${
                Math.round(megapixels * 10) / 10
              }MP) → Predicted quality: ${predictedQuality}%`
            );
          } else if (originalSize > 5 * 1024 * 1024) {
            predictedQuality = Math.max(
              1,
              Math.round(compressionRatio * 100 * 0.6)
            );
            console.log(
              `📦 Very large file (${
                Math.round((originalSize / (1024 * 1024)) * 10) / 10
              }MB) → Predicted quality: ${predictedQuality}%`
            );
          } else {
            predictedQuality = Math.max(
              1,
              Math.round(compressionRatio * 100 * 0.8)
            );
            console.log(
              `📊 Standard compression → Predicted quality: ${predictedQuality}%`
            );
          }

          // Hybrid Algorithm: Predictive Quality + Minimal Verification
          let attempts = 0;
          finalQuality = predictedQuality;

          // Step 1: Test the prediction
          attempts++;
          console.log(
            `🎯 Attempt ${attempts}: Testing predicted quality ${finalQuality}%...`
          );

          processedBuffer = await processImage(file.buffer, {
            quality: finalQuality,
            originalMetadata: originalMetadata,
          });

          finalSize = processedBuffer.length;
          console.log(
            `🎯 Attempt ${attempts} result: Quality ${finalQuality}% → ${Math.round(
              finalSize / 1024
            )}KB`
          );

          // Step 2: Fine-tuning loop - maximum 2 attempts
          while (
            finalSize > targetSizeBytes &&
            finalQuality > 1 &&
            attempts < 2
          ) {
            const deviation =
              Math.abs(finalSize - targetSizeBytes) / targetSizeBytes;
            console.log(
              `🔧 Size ${Math.round(
                finalSize / 1024
              )}KB > target ${targetSizeKB}KB (deviation: ${Math.round(
                deviation * 100
              )}%), continuing compression...`
            );

            // Calculate more aggressive adjustment
            const adjustmentFactor = targetSizeBytes / finalSize;
            let adjustedQuality;

            if (attempts === 1) {
              // First adjustment: use standard formula
              adjustedQuality = Math.max(
                1,
                Math.min(
                  95,
                  Math.round(finalQuality * Math.pow(adjustmentFactor, 0.5))
                )
              );
            } else {
              // Subsequent attempts: be more aggressive
              adjustedQuality = Math.max(
                1,
                Math.round(finalQuality * adjustmentFactor * 0.8)
              );
            }

            // Ensure we're making progress
            if (adjustedQuality >= finalQuality) {
              adjustedQuality = Math.max(1, finalQuality - 5);
            }

            if (adjustedQuality !== finalQuality) {
              attempts++;
              finalQuality = adjustedQuality;
              console.log(
                `🎯 Attempt ${attempts}: Trying quality ${finalQuality}%...`
              );

              processedBuffer = await processImage(file.buffer, {
                quality: finalQuality,
                originalMetadata: originalMetadata,
              });

              finalSize = processedBuffer.length;
              console.log(
                `🎯 Attempt ${attempts} result: Quality ${finalQuality}% → ${Math.round(
                  finalSize / 1024
                )}KB`
              );
            } else {
              break;
            }
          }

          compressionApplied = true;
          const compressionPercentage = Math.round(
            (1 - finalSize / originalSize) * 100
          );
          console.log(
            `✅ SMART COMPRESSION complete: ${originalSize} → ${finalSize} bytes (${compressionPercentage}% reduction) in ${attempts} attempts`
          );

          // Final result analysis
          if (finalSize > targetSizeBytes) {
            if (finalQuality === 1) {
              console.log(
                `⚠️  Final size ${Math.round(
                  finalSize / 1024
                )}KB still exceeds target even at 1% quality (minimum). This is the absolute minimum achievable without resizing.`
              );
            } else {
              console.log(
                `⚠️  Final size ${Math.round(
                  finalSize / 1024
                )}KB still exceeds target. Stopped at ${finalQuality}% quality after ${attempts} attempts.`
              );
            }
          } else {
            console.log(
              `🎉 TARGET ACHIEVED! Final size ${Math.round(
                finalSize / 1024
              )}KB ≤ ${targetSizeKB}KB at ${finalQuality}% quality.`
            );
          }
        } else {
          console.log(
            `✅ File ≤ ${targetSizeKB}KB, uploading as-is (converting to WebP only)`
          );

          // Convert to WebP but keep original quality
          processedBuffer = await processImage(file.buffer, {
            quality: 100,
            originalMetadata: originalMetadata,
          });

          finalSize = processedBuffer.length;
          finalQuality = 100;
          const reductionPercentage = Math.round(
            (1 - finalSize / originalSize) * 100
          );
          console.log(
            `✅ WebP conversion: ${originalSize} → ${finalSize} bytes (${reductionPercentage}% reduction)`
          );
        }

        // Save the processed buffer to disk
        await fs.writeFile(filepath, processedBuffer);

        // Get the file size after processing (double-check)
        const stats = await fs.stat(filepath);
        const result = {
          size: stats.size,
          compressed: compressionApplied,
          quality: finalQuality,
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
          altText: metadata.altText || `Image ${i + 1}`,
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
          `✅ PROCESSING COMPLETE for image ${i + 1}: ${
            file.originalname
          } → ${filename}`
        );
        console.log(
          `📊 FINAL STATS: ${processedImage.originalSize} → ${processedImage.size} bytes (${processedImage.compressionRatio}% reduction, quality: ${processedImage.quality}%)`
        );
        console.log(`🔗 Image URL: ${fullImageUrl}`);
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
    req.processedImages = processedImages; // Also set for blog controller compatibility
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

    // Log final compression summary
    console.log(`\n🎉 === SMART COMPRESSION SUMMARY ===`);
    const compressedImages = processedImages.filter(
      (img) => img.compressionApplied
    );
    const asIsImages = processedImages.filter((img) => !img.compressionApplied);
    const totalOriginalSize = processedImages.reduce(
      (sum, img) => sum + img.originalSize,
      0
    );
    const totalFinalSize = processedImages.reduce(
      (sum, img) => sum + img.size,
      0
    );
    const totalSavings = totalOriginalSize - totalFinalSize;
    const overallCompressionRatio = Math.round(
      (totalSavings / totalOriginalSize) * 100
    );

    console.log(`📊 Total images processed: ${processedImages.length}`);
    console.log(`🗜️  Images compressed: ${compressedImages.length}`);
    console.log(`✅ Images as-is (≤100KB): ${asIsImages.length}`);
    console.log(
      `📦 Original total size: ${Math.round(totalOriginalSize / 1024)}KB`
    );
    console.log(`📦 Final total size: ${Math.round(totalFinalSize / 1024)}KB`);
    console.log(`💾 Total space saved: ${Math.round(totalSavings / 1024)}KB`);
    console.log(`📈 Overall compression: ${overallCompressionRatio}%`);

    processedImages.forEach((img, index) => {
      const action = img.compressionApplied ? "COMPRESSED" : "AS-IS";
      console.log(
        `   ${index + 1}. [${action}] ${img.originalName}: ${Math.round(
          img.originalSize / 1024
        )}KB → ${Math.round(img.size / 1024)}KB (${img.compressionRatio}%, Q:${
          img.quality
        }%)`
      );
    });
    console.log(`🎉 === END COMPRESSION SUMMARY ===\n`);

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
