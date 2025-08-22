/**
 * Image Processing Service
 * Handles image compression and optimization using Sharp (preserves original dimensions)
 */

const sharp = require("sharp");
const path = require("path");

/**
 * Process and compress image buffer (preserves original dimensions)
 * @param {Buffer} imageBuffer - Original image buffer
 * @param {Object} options - Processing options (quality, format, etc.)
 * @returns {Promise<Buffer>} - Processed image buffer
 */
const processImage = async (imageBuffer, options = {}) => {
  try {
    const {
      quality = 85,
      originalMetadata = null, // Pass original image metadata for smart compression
    } = options;

    // Validate image buffer
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error("Empty or invalid image buffer");
    }

    // Get original metadata if not provided
    const metadata = originalMetadata || (await getImageMetadata(imageBuffer));

    // Use the requested quality directly
    const smartQuality = quality;

    console.log(
      `🔍 Processing image: ${metadata.width}x${metadata.height}, quality: ${smartQuality}%`
    );
    console.log(`🔍 Preserving original dimensions (no resize needed)`);

    let sharpInstance = sharp(imageBuffer);

    // Apply pre-processing optimizations for better compression
    // (These don't change dimensions but can improve compression efficiency)
    if (smartQuality < 50) {
      // For aggressive compression, apply more pre-processing
      console.log(
        `🔧 Applying aggressive pre-processing for quality ${smartQuality}%`
      );
      sharpInstance = sharpInstance
        .normalize() // Normalize image to improve compression
        .modulate({
          brightness: 1.0, // Keep original brightness
          saturation: 0.95, // Reduce saturation more for better compression
          hue: 0, // Keep original hue
        })
        .blur(0.3); // Very subtle blur to reduce noise and improve compression
    } else {
      // For moderate compression, apply lighter pre-processing
      sharpInstance = sharpInstance
        .normalize() // Normalize image to improve compression
        .modulate({
          brightness: 1.0, // Keep original brightness
          saturation: 0.98, // Slightly reduce saturation for better compression
          hue: 0, // Keep original hue
        });
    }

    // Apply WebP compression with maximum compression settings
    const webpOptions = {
      quality: smartQuality,
      effort: 6, // Maximum effort for best compression (0-6)
      method: 6, // Maximum compression method (0-6, higher = better compression)
      smartSubsample: true, // Enable smart subsampling for better compression
      lossless: false, // Use lossy compression for smaller files
      nearLossless: false, // Disable near-lossless for maximum compression
      alphaQuality: Math.max(10, smartQuality - 10), // Lower alpha quality for transparency
      mixed: true, // Allow mixed compression modes for optimal results
      preset: "photo", // Optimize for photographic content
    };

    // For very low quality, enable additional compression features
    if (smartQuality < 30) {
      console.log(
        `🔧 Enabling ultra-compression mode for quality ${smartQuality}%`
      );
      webpOptions.reductionEffort = 6; // Maximum reduction effort
      webpOptions.smartSubsample = false; // Disable smart subsampling for maximum compression
    }

    sharpInstance = sharpInstance.webp(webpOptions).withMetadata(false); // Strip all metadata to save additional bytes

    const processedBuffer = await sharpInstance.toBuffer();

    console.log(
      `✅ Image processed: ${imageBuffer.length} bytes → ${
        processedBuffer.length
      } bytes (${Math.round(
        (1 - processedBuffer.length / imageBuffer.length) * 100
      )}% reduction)`
    );

    return processedBuffer;
  } catch (error) {
    console.error("❌ Image processing error:", error);
    throw new Error(`Image processing failed: ${error.message}`);
  }
};

/**
 * Get image metadata
 * @param {Buffer} imageBuffer - Image buffer
 * @returns {Promise<Object>} - Image metadata
 */
const getImageMetadata = async (imageBuffer) => {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: metadata.size,
      hasAlpha: metadata.hasAlpha,
      channels: metadata.channels,
    };
  } catch (error) {
    console.error("❌ Error getting image metadata:", error);
    throw new Error(`Failed to get image metadata: ${error.message}`);
  }
};

/**
 * Validate image format and size
 * @param {Buffer} imageBuffer - Image buffer
 * @param {Object} options - Validation options
 * @returns {Promise<boolean>} - Validation result
 */
const validateImage = async (imageBuffer, options = {}) => {
  try {
    const {
      maxSizeBytes = 11 * 1024 * 1024, // 11MB default
      allowedFormats = ["jpeg", "jpg", "png", "webp"],
      minWidth = 100,
      minHeight = 100,
    } = options;

    // Check buffer size
    if (imageBuffer.length > maxSizeBytes) {
      throw new Error(
        `Image too large: ${imageBuffer.length} bytes (max: ${maxSizeBytes} bytes)`
      );
    }

    // Get metadata
    const metadata = await getImageMetadata(imageBuffer);

    // Check format
    if (!allowedFormats.includes(metadata.format.toLowerCase())) {
      throw new Error(
        `Unsupported format: ${metadata.format} (allowed: ${allowedFormats.join(
          ", "
        )})`
      );
    }

    // Check dimensions
    if (metadata.width < minWidth || metadata.height < minHeight) {
      throw new Error(
        `Image too small: ${metadata.width}x${metadata.height} (min: ${minWidth}x${minHeight})`
      );
    }

    return true;
  } catch (error) {
    console.error("❌ Image validation error:", error);
    throw error;
  }
};

module.exports = {
  processImage,
  getImageMetadata,
  validateImage,
};
