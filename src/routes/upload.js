/**
 * Upload Routes
 * Test routes for image upload functionality
 */

const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const {
  handlePropertyImageUpload,
  handleSmartCompressedImageUpload,
} = require("../middleware/imageUpload");

/**
 * @route   POST /api/upload/images
 * @desc    Upload images with smart compression (100KB threshold, no timeout)
 * @access  Admin only
 */
router.post("/images", auth, handleSmartCompressedImageUpload, (req, res) => {
  try {
    if (!req.uploadedImages || req.uploadedImages.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No images uploaded",
      });
    }

    const processedImages = req.uploadedImages.map((image, index) => {
      return {
        url: image.url, // Use image URL
        publicId: image.publicId,
        altText: image.altText || `Property image ${index + 1}`,
        order: index,
        isMain: index === 0, // First image is main by default
        originalName: image.originalName,
        size: image.size,
        originalSize: image.originalSize,
        compressionRatio: image.compressionRatio,
        format: image.format,
        width: image.width,
        height: image.height,
        compressed: image.compressionApplied,
        quality: image.quality,
        compressionApplied: image.compressionApplied,
        action: image.compressionApplied ? "COMPRESSED" : "AS-IS",
      };
    });

    // Calculate statistics
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

    res.status(200).json({
      success: true,
      message: `Successfully uploaded and processed ${processedImages.length} images with smart compression`,
      statistics: {
        totalImages: processedImages.length,
        compressed: compressedImages.length,
        asIs: asIsImages.length,
        originalTotalSize: `${Math.round(totalOriginalSize / 1024)}KB`,
        finalTotalSize: `${Math.round(totalFinalSize / 1024)}KB`,
        totalSavings: `${Math.round(totalSavings / 1024)}KB`,
        overallCompression: `${overallCompressionRatio}%`,
      },
      data: {
        images: processedImages,
      },
    });
  } catch (error) {
    console.error("Image upload error:", error);
    res.status(500).json({
      success: false,
      error: "Image upload failed",
      details: error.message,
    });
  }
});

module.exports = router;
