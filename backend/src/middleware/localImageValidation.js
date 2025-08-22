/**
 * Local Image URL Validation Helper
 * Validates image URLs for local storage system
 */

/**
 * Validates if a URL is a valid image URL (local or external)
 * @param {string} url - The URL to validate
 * @returns {boolean} - True if valid, false otherwise
 */
const validateImageUrl = (url) => {
  if (!url || typeof url !== "string") {
    return false;
  }

  // Regular URL pattern for external images
  const urlRegex = /^https?:\/\/.+(\.(jpg|jpeg|png|webp)|\/[^\/]+)$/i;

  // Local upload URL pattern
  const localUrlRegex =
    /^https?:\/\/localhost:\d+\/uploads\/.+\.(jpg|jpeg|png|webp)$/i;

  // Base URL pattern for production (can be configured)
  const baseUrlRegex = /^https?:\/\/[^\/]+\/uploads\/.+\.(jpg|jpeg|png|webp)$/i;

  return (
    urlRegex.test(url) || localUrlRegex.test(url) || baseUrlRegex.test(url)
  );
};

module.exports = {
  validateImageUrl,
};
