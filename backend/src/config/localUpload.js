/**
 * Local File Upload Configuration
 * Handles image upload to local filesystem with multer and image compression
 */

const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const {
  processImage,
  validateImage,
  getImageMetadata,
} = require("./imageProcessor");

// Custom storage engine for smart compression (100KB threshold)
class SmartCompressionStorage {
  constructor(options) {
    // For production builds, store uploads inside the dist directory
    const defaultUploadDir =
      process.env.NODE_ENV === "production"
        ? path.join(__dirname, "uploads") // dist/uploads
        : path.join(__dirname, "../uploads"); // backend/src/uploads

    this.destination = options.destination || defaultUploadDir;
    this.folderName = options.folderName || "";
    this.baseUrl =
      options.baseUrl ||
      (process.env.BASE_URL
        ? `${process.env.BASE_URL}/uploads`
        : "http://localhost:8000/uploads");
  }

  async _ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Enhanced prediction algorithm optimized for 1% minimum quality
   * Directly predicts when extreme compression is needed
   */
  _predictOptimalQuality(fileSize, width, height, targetSize) {
    const pixelCount = width * height;
    const compressionRatio = targetSize / fileSize;
    const megapixels = pixelCount / (1024 * 1024);

    // For extreme compression ratios (>90% reduction needed), start very low
    if (compressionRatio < 0.1) {
      return 1;
    }

    // For very high resolution images (>20MP), be very aggressive
    if (megapixels > 20) {
      const quality = Math.max(1, Math.round(compressionRatio * 100 * 0.3));
      console.log(
        `🖼️ Very high resolution (${
          Math.round(megapixels * 10) / 10
        }MP) → Quality ${quality}%`
      );
      return quality;
    }

    // For high resolution images (>10MP), be aggressive
    if (megapixels > 10) {
      const quality = Math.max(1, Math.round(compressionRatio * 100 * 0.5));
      console.log(
        `📸 High resolution (${
          Math.round(megapixels * 10) / 10
        }MP) → Quality ${quality}%`
      );
      return quality;
    }

    // For very large files (>5MB), be aggressive regardless of resolution
    if (fileSize > 5 * 1024 * 1024) {
      const quality = Math.max(1, Math.round(compressionRatio * 100 * 0.6));
      console.log(
        `📦 Very large file (${
          Math.round((fileSize / (1024 * 1024)) * 10) / 10
        }MB) → Quality ${quality}%`
      );
      return quality;
    }

    // Standard prediction for smaller files
    const baseQuality = Math.max(1, Math.round(compressionRatio * 100 * 0.8));

    return baseQuality;
  }

  _handleFile(req, file, cb) {
    // Collect file data
    const chunks = [];

    file.stream.on("data", (chunk) => {
      chunks.push(chunk);
    });

    file.stream.on("end", async () => {
      try {
        const originalBuffer = Buffer.concat(chunks);
        const originalSize = originalBuffer.length;
        const originalSizeKB = Math.round(originalSize / 1024);

        console.log(
          `📊 Original size: ${originalSize} bytes (${originalSizeKB}KB)`
        );

        // Validate image
        await validateImage(originalBuffer);

        // Get original metadata
        const originalMetadata = await getImageMetadata(originalBuffer);
        console.log(
          `📐 Original dimensions: ${originalMetadata.width}x${originalMetadata.height}`
        );

        // Generate filename
        const timestamp = Date.now();
        const originalName = file.originalname
          .split(".")[0]
          .replace(/\s+/g, "_")
          .replace(/[^a-zA-Z0-9_-]/g, "");

        // Ensure upload directory exists
        const uploadDir = this.folderName
          ? path.join(this.destination, this.folderName)
          : this.destination;
        await this._ensureDirectoryExists(uploadDir);

        // Smart compression logic based on 100KB threshold
        const targetSizeBytes = 100 * 1024; // 100KB
        const targetSizeKB = 100;
        let processedBuffer;
        let finalSize;
        let compressionApplied = false;
        let finalQuality = 100;

        if (originalSize > targetSizeBytes) {
          console.log(
            `🎯 Starting hybrid compression: target ≤${targetSizeKB}KB`
          );

          // Hybrid Algorithm: Predictive Quality + Minimal Verification
          let attempts = 0;

          // Step 1: Predict optimal quality based on image characteristics
          const predictedQuality = this._predictOptimalQuality(
            originalSize,
            originalMetadata.width,
            originalMetadata.height,
            targetSizeBytes
          );

          // Step 2: Test the prediction
          attempts++;
          processedBuffer = await processImage(originalBuffer, {
            quality: predictedQuality,
            originalMetadata: originalMetadata,
          });

          finalSize = processedBuffer.length;
          finalQuality = predictedQuality;

          // Step 3: Fine-tuning loop - maximum 2 attempts since prediction is now accurate
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
              )}KB > target 100KB (deviation: ${Math.round(
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
                Math.round(finalQuality * adjustmentFactor * 0.8) // More aggressive reduction
              );
            }

            // Ensure we're making progress (don't use same quality)
            if (adjustedQuality >= finalQuality) {
              adjustedQuality = Math.max(1, finalQuality - 5); // Force reduction by at least 5%
            }

            if (adjustedQuality !== finalQuality) {
              attempts++;
              console.log(
                `🎯 Attempt ${attempts}: Trying quality ${adjustedQuality}%...`
              );

              processedBuffer = await processImage(originalBuffer, {
                quality: adjustedQuality,
                originalMetadata: originalMetadata,
              });

              finalSize = processedBuffer.length;
              finalQuality = adjustedQuality;

              console.log(
                `🎯 Attempt ${attempts}: Quality ${adjustedQuality}% → ${Math.round(
                  finalSize / 1024
                )}KB`
              );
            } else {
              // Can't reduce quality further
              break;
            }
          }

          compressionApplied = true;
          console.log(
            `✅ Hybrid compression complete: ${originalSize} → ${finalSize} bytes (${Math.round(
              (1 - finalSize / originalSize) * 100
            )}% reduction) in ${attempts} attempts`
          );

          // Final result analysis
          if (finalSize > targetSizeBytes) {
            if (finalQuality === 1) {
              console.log(
                `⚠️ Final size ${Math.round(
                  finalSize / 1024
                )}KB still exceeds target even at 1% quality (minimum). Dimensions preserved at ${
                  originalMetadata.width
                }x${
                  originalMetadata.height
                }. This is the absolute minimum achievable without resizing.`
              );
            } else {
              console.log(
                `⚠️ Final size ${Math.round(
                  finalSize / 1024
                )}KB still exceeds target. Stopped at ${finalQuality}% quality after ${attempts} attempts. Dimensions preserved at ${
                  originalMetadata.width
                }x${originalMetadata.height}.`
              );
            }
          } else {
            console.log(
              `🎉 Target achieved! Final size ${Math.round(
                finalSize / 1024
              )}KB ≤ 100KB at ${finalQuality}% quality.`
            );
          }
        } else {
          console.log(
            `✅ File ≤ 100KB, uploading as-is (converting to WebP only)`
          );

          // Convert to WebP but keep original quality and dimensions
          processedBuffer = await processImage(originalBuffer, {
            quality: 100, // Keep high quality for small images
            originalMetadata: originalMetadata,
          });

          finalSize = processedBuffer.length;
          finalQuality = 100;
          console.log(
            `✅ WebP conversion: ${originalSize} → ${finalSize} bytes (${Math.round(
              (1 - finalSize / originalSize) * 100
            )}% reduction)`
          );
        }

        const fileName = `property_${timestamp}_${originalName}.webp`;
        const filePath = path.join(uploadDir, fileName);
        const relativePath = this.folderName
          ? path.join(this.folderName, fileName).replace(/\\/g, "/")
          : fileName;

        // Save processed image
        await fs.writeFile(filePath, processedBuffer);

        // Generate URL
        const imageUrl = `${this.baseUrl}/${relativePath}`;

        // Calculate compression ratio
        const compressionRatio = Math.round(
          (1 - finalSize / originalSize) * 100
        );

        // Return file info in multer format
        const fileResult = {
          destination: uploadDir,
          filename: fileName,
          path: filePath,
          location: imageUrl,
          originalname: file.originalname,
          mimetype: "image/webp",
          size: finalSize,
          originalSize: originalSize,
          compressionRatio: compressionRatio,
          compressionApplied: compressionApplied,
          quality: finalQuality,
          width: originalMetadata.width,
          height: originalMetadata.height,
          format: "webp",
          compressed: compressionApplied,
          // Add processed image data for compatibility
          processedImages: {
            url: imageUrl,
            filename: fileName,
            path: filePath,
            size: finalSize,
            dimensions: `${originalMetadata.width}x${originalMetadata.height}`,
            relativePath: relativePath,
          },
          key: relativePath.replace(/\.[^/.]+$/, ""),
        };

        cb(null, fileResult);
      } catch (error) {
        console.error("❌ Error processing/saving image:", error);
        cb(error);
      }
    });

    file.stream.on("error", (error) => {
      console.error("❌ Stream error:", error);
      cb(error);
    });
  }

  _removeFile(req, file, cb) {
    // Delete file from local filesystem if needed
    if (file.path) {
      fs.unlink(file.path)
        .then(() => {
          cb(null);
        })
        .catch((error) => {
          console.error(`❌ Error deleting file: ${file.path}`, error);
          cb(error);
        });
    } else {
      cb(null);
    }
  }
}

// Configure Smart Compression Storage for Property Images
const smartCompressionStorage = new SmartCompressionStorage({
  folderName: "", // Upload directly to uploads folder
  baseUrl: process.env.BASE_URL
    ? `${process.env.BASE_URL}/uploads`
    : "http://localhost:8000/uploads",
});

// Configure multer with smart compression storage
const uploadSmartCompressedImages = multer({
  storage: smartCompressionStorage,
  limits: {
    fileSize: 11 * 1024 * 1024, // 11MB limit per file
    files: 10, // Maximum 10 images per upload
  },
  fileFilter: (req, file, cb) => {
    console.log(
      "🔍 Smart compression fileFilter called for file:",
      file.originalname,
      "mimetype:",
      file.mimetype
    );

    // Check file type
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

// Create an alias for backward compatibility
const uploadPropertyImages = uploadSmartCompressedImages;

module.exports = {
  uploadPropertyImages, // Now uses smart compression
  uploadSmartCompressedImages,
  SmartCompressionStorage,
};
