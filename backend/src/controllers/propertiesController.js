const Property = require("../models/Property");
const {
  EMIRATES,
  PROPERTY_TYPES,
  PROPERTY_TYPE_AMENITIES_MAP,
  EMIRATE_AREA_MAP,
  PROPERTY_STATUS,
} = require("../constants/propertyTypes");
const fs = require("fs").promises;
const path = require("path");

/**
 * Helper function to delete local image files
 * @param {string} publicId - The public ID of the image (filename without extension)
 */
const deleteLocalImageFiles = async (publicId) => {
  try {
    // Determine upload directory based on environment
    const uploadDir =
      process.env.NODE_ENV === "production"
        ? path.join(__dirname, "uploads") // dist/uploads
        : path.join(__dirname, "../uploads"); // backend/src/uploads

    // List of possible file extensions and sizes
    const possibleFiles = [
      `${publicId}.webp`,
      `${publicId}_thumb.webp`,
      `${publicId}_medium.webp`,
      `${publicId}_large.webp`,
      `${publicId}_original.webp`,
      `${publicId}.jpg`,
      `${publicId}.jpeg`,
      `${publicId}.png`,
    ];

    const deletionPromises = possibleFiles.map(async (filename) => {
      const filePath = path.join(uploadDir, filename);
      try {
        await fs.access(filePath); // Check if file exists
        await fs.unlink(filePath); // Delete the file
        console.log(`✅ Deleted local file: ${filename}`);
      } catch (error) {
        // File doesn't exist or couldn't be deleted - this is okay
        console.log(`ℹ️ File not found or already deleted: ${filename}`);
      }
    });

    await Promise.all(deletionPromises);
    console.log(`🗑️ Completed deletion attempt for publicId: ${publicId}`);
  } catch (error) {
    console.error(
      `❌ Error deleting local files for publicId ${publicId}:`,
      error
    );
    throw error;
  }
};

/**
 * Helper function to get valid status transitions for a given current status
 * @param {string} currentStatus - The current property status
 * @returns {string[]} - Array of valid status transitions
 */
const getValidTransitions = (currentStatus) => {
  // Define invalid transitions
  const invalidTransitions = {
    available: ["draft"],
    archived: ["draft"],
    sold: ["rented", "available", "draft"],
  };

  // Get all possible statuses except the current one
  const allStatuses = PROPERTY_STATUS.filter(
    (status) => status !== currentStatus
  );

  // Remove invalid transitions
  const invalidForCurrent = invalidTransitions[currentStatus] || [];
  return allStatuses.filter((status) => !invalidForCurrent.includes(status));
};

/**
 * Get all available property types (predefined + approved custom) for Admin Only
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAvailablePropertyTypes = async (req, res) => {
  try {
    // Additional admin role check (auth middleware already verified token)
    if (
      !req.user ||
      (req.user.role !== "admin" && req.user.role !== "SuperAdmin")
    ) {
      return res.status(403).json({
        success: false,
        error: "Access denied. Admin privileges required.",
      });
    }

    // Get predefined property types
    const predefinedTypes = PROPERTY_TYPES.map((type) => ({
      name: type,
    }));

    res.status(200).json({
      success: true,
      data: {
        propertyTypes: predefinedTypes, // Simple array for easy frontend consumption
        total: predefinedTypes.length,
      },
    });
  } catch (error) {
    console.error("Error fetching available property types:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch available property types",
    });
  }
};

/**
 * Get valid areas for a specific emirate (Admin only - for property management)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAreasForEmirate = (req, res) => {
  try {
    // Additional admin role check (auth middleware already verified token)
    if (
      !req.user ||
      (req.user.role !== "admin" && req.user.role !== "SuperAdmin")
    ) {
      return res.status(403).json({
        success: false,
        error: "Access denied. Admin privileges required.",
      });
    }

    const { emirate } = req.params;

    // Input validation and sanitization
    if (!emirate || typeof emirate !== "string") {
      return res.status(400).json({
        success: false,
        error: "Emirate parameter is required and must be a string",
      });
    }

    // Sanitize input - remove any potential malicious characters
    const sanitizedEmirate = emirate.trim().replace(/[<>\"'&]/g, "");

    // Find matching emirate (case-insensitive)
    const matchedEmirate = EMIRATES.find(
      (validEmirate) =>
        validEmirate.toLowerCase() === sanitizedEmirate.toLowerCase()
    );

    if (!matchedEmirate) {
      return res.status(400).json({
        success: false,
        error: `Invalid emirate. Valid options are: ${EMIRATES.join(", ")}`,
      });
    }

    // Get areas for the specified emirate (use the properly cased version)
    const areas = EMIRATE_AREA_MAP[matchedEmirate] || [];

    res.status(200).json({
      success: true,
      data: {
        emirate: matchedEmirate,
        areas,
        count: areas.length,
      },
      message: `Found ${areas.length} areas in ${matchedEmirate}`,
    });
  } catch (error) {
    console.error("Error fetching areas for emirate:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch areas for emirate",
    });
  }
};

/**
 * Get valid amenities for a specific property type (Admin only - for property management)
 * Includes both predefined amenities and approved custom amenities
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAmenitiesForPropertyType = async (req, res) => {
  try {
    // Additional admin role check (auth middleware already verified token)
    if (
      !req.user ||
      (req.user.role !== "admin" && req.user.role !== "SuperAdmin")
    ) {
      return res.status(403).json({
        success: false,
        error: "Access denied. Admin privileges required.",
      });
    }

    const { propertyType } = req.params;

    // Input validation and sanitization
    if (!propertyType || typeof propertyType !== "string") {
      return res.status(400).json({
        success: false,
        error: "Property type parameter is required and must be a string",
      });
    }

    // Sanitize input - remove any potential malicious characters
    const sanitizedPropertyType = propertyType.trim().replace(/[<>\"'&]/g, "");

    // Find matching property type (case-insensitive)
    const matchedPropertyType = PROPERTY_TYPES.find(
      (validType) =>
        validType.toLowerCase() === sanitizedPropertyType.toLowerCase()
    );

    if (matchedPropertyType) {
      // Get predefined amenities for the specified property type
      const predefinedAmenities =
        PROPERTY_TYPE_AMENITIES_MAP[matchedPropertyType] || [];

      res.status(200).json({
        success: true,
        data: {
          propertyType: matchedPropertyType,
          all: predefinedAmenities,
          total: predefinedAmenities.length,
        },
      });
    }
  } catch (error) {
    console.error("Error fetching amenities for property type:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch amenities for property type",
    });
  }
};

/**
 * Get all properties with filtering and pagination
 * Role-based access: Visitors see only published properties, Admins see all
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getProperties = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      emirate,
      area,
      propertyType,
      listingType,
      minPrice,
      maxPrice,
      bedrooms,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Start with ACL query filters (set by ACL middleware for visitors)
    const filter = { ...req.queryFilters } || {};

    // Handle status filter based on user role
    const userRole = req.userRole || "visitor";
    if (status) {
      if (userRole === "admin") {
        // Admin can filter by any status
        filter.status = status;
      } else {
        // Visitors can only filter by published statuses
        const publishedStatuses = ["available", "sold", "rented", "pending"];
        if (publishedStatuses.includes(status)) {
          filter.status = status;
        }
        // If invalid status requested, ignore it (keep ACL default)
      }
    }

    // Apply additional user-specified filters
    if (emirate) filter["location.emirate"] = emirate;
    if (area) filter["location.area"] = area;
    if (propertyType) filter.propertyType = propertyType;
    if (listingType) filter.listingType = listingType;
    if (bedrooms) filter["details.bedrooms"] = parseInt(bedrooms);

    // Price range filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseInt(minPrice);
      if (maxPrice) filter.price.$lte = parseInt(maxPrice);
    }

    // Build sort object
    const sortObject = {};
    sortObject[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const properties = await Property.find(filter)
      .populate("createdBy", "name email")
      .sort(sortObject)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Property.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        properties,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit),
        },
        // Include filter info for debugging (admin only)
        ...(userRole === "admin" && { appliedFilters: filter }),
      },
    });
  } catch (error) {
    console.error("Error fetching properties:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch properties",
    });
  }
};

/**
 * Get single property by ID or slug
 * Role-based access: Visitors see only published properties, Admins see all
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.userRole || "visitor";

    // Build query filter based on user role (from ACL middleware)
    const baseQuery = req.queryFilters || {};

    // Try to find by ID first, then by slug
    let property = null;

    try {
      // Try as MongoDB ObjectId first
      property = await Property.findOne({ _id: id, ...baseQuery }).populate(
        "createdBy",
        "name email"
      );
    } catch (err) {
      // If ID is invalid, it will throw an error, so we continue to slug search
    }

    // If not found by ID, try by slug
    if (!property) {
      property = await Property.findOne({ slug: id, ...baseQuery }).populate(
        "createdBy",
        "name email"
      );
    }

    if (!property) {
      return res.status(404).json({
        success: false,
        error:
          userRole === "admin"
            ? "Property not found"
            : "Property not found or not available for public viewing",
      });
    }

    res.status(200).json({
      success: true,
      data: { property },
    });
  } catch (error) {
    console.error("Error fetching property:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch property",
    });
  }
};

/**
 * Create property with pre-uploaded image data (for testing/admin)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createPropertyWithImages = async (req, res) => {
  try {
    // ACL middleware has already verified admin permissions
    const propertyData = {
      ...req.body,
      createdBy: req.user.id,
    };

    // Validate that images are provided in the request body
    if (
      !req.body.images ||
      !Array.isArray(req.body.images) ||
      req.body.images.length === 0
    ) {
      return res.status(400).json({
        success: false,
        error: "At least one property image is required in the images array.",
      });
    }

    propertyData.images = req.body.images.map((image, index) => {
      return {
        url: image.url, // Use large image as main URL
        publicId: image.publicId,
        altText: image.altText || `Property image ${index + 1}`,
        order: image.order !== undefined ? image.order : index,
        isMain: image.isMain !== undefined ? image.isMain : index === 0,
        originalName: image.originalName,
        size: image.size,
        format: image.format,
      };
    });

    const property = new Property(propertyData);
    await property.save();

    // Prepare response object
    const response = {
      success: true,
      data: {
        property,
      },
      message: `Property created successfully with ${propertyData.images.length} pre-uploaded images`,
    };

    // Add warnings if any exist
    if (req.validationWarnings && req.validationWarnings.length > 0) {
      response.warnings = req.validationWarnings;
    }

    res.status(201).json(response);
  } catch (error) {
    console.error("Error creating property with images:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to create property with images",
    });
  }
};

/**
 * Update property (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateProperty = async (req, res) => {
  try {
    // ACL middleware has already verified admin permissions
    const { id } = req.params;

    // Get existing property to handle image updates
    let existingProperty;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      existingProperty = await Property.findById(id);
    } else {
      existingProperty = await Property.findOne({ slug: id });
    }

    if (!existingProperty) {
      return res.status(404).json({
        success: false,
        error: "Property not found",
      });
    }

    // Check ownership for admin users (SuperAdmin can update any property)
    if (req.requireOwnership && req.userRole === "admin") {
      const ownerId = existingProperty.createdBy?.toString();
      if (ownerId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: "Access denied - You can only update properties you created",
        });
      }
    }

    // Property data is now parsed by middleware and available in req.body
    const propertyData = req.body;
    console.log(
      "✅ Using property data from req.body:",
      Object.keys(propertyData)
    );

    // Validate status transitions if status is being updated
    if (
      propertyData.status &&
      propertyData.status !== existingProperty.status
    ) {
      const currentStatus = existingProperty.status;
      const newStatus = propertyData.status;

      // Define invalid status transitions
      const invalidTransitions = {
        available: ["draft"],
        archived: ["draft"],
        sold: ["rented", "available", "draft"],
      };

      // Check if the transition is invalid
      if (
        invalidTransitions[currentStatus] &&
        invalidTransitions[currentStatus].includes(newStatus)
      ) {
        return res.status(400).json({
          success: false,
          error: `Invalid status transition: Cannot change status from '${currentStatus}' to '${newStatus}'`,
          details: {
            currentStatus,
            attemptedStatus: newStatus,
            allowedTransitions: getValidTransitions(currentStatus),
          },
        });
      }
    }

    const updateData = {
      ...propertyData,
      updatedBy: req.user.id,
    };

    // Handle image updates
    if (req.uploadedImages && req.uploadedImages.length > 0) {
      // If new images are uploaded, add them to existing images
      const newImages = req.uploadedImages.map((image, index) => {
        return {
          url: image.url, // Use large image as main URL
          publicId: image.publicId,
          altText: `Property image ${
            existingProperty.images.length + index + 1
          }`,
          order: existingProperty.images.length + index,
          isMain: existingProperty.images.length === 0 && index === 0, // First image is main if no existing images
          originalName: image.originalName,
          size: image.size,
          format: image.format,
        };
      });

      updateData.images = [...existingProperty.images, ...newImages];
    } else if (propertyData.images !== undefined) {
      // If images array is provided in request body (for reordering/removing existing images)
      // This handles cases where frontend sends updated images array without new file uploads
      updateData.images = propertyData.images;
    }

    // Update the existing property object and save it to trigger pre-save hooks
    Object.assign(existingProperty, updateData);

    // Save the property to trigger pre-save hooks (including slug generation)
    const property = await existingProperty.save();

    // Populate the user fields
    await property.populate("createdBy updatedBy", "name email");

    res.status(200).json({
      success: true,
      data: { property },
      message: "Property updated successfully",
    });
  } catch (error) {
    console.error("Error updating property:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to update property",
    });
  }
};

/**
 * Delete property (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteProperty = async (req, res) => {
  try {
    // ACL middleware has already verified admin permissions
    const { id } = req.params;

    // Find property first to get image info
    let property;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      property = await Property.findById(id);
    } else {
      property = await Property.findOne({ slug: id });
    }

    if (!property) {
      return res.status(404).json({
        success: false,
        error: "Property not found",
      });
    }

    // Check ownership for admin users (SuperAdmin can delete any property)
    if (req.requireOwnership && req.userRole === "admin") {
      const ownerId = property.createdBy?.toString();
      if (ownerId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: "Access denied - You can only delete properties you created",
        });
      }
    }

    // Delete images from local storage
    if (property.images && property.images.length > 0) {
      const deletePromises = property.images.map((image) =>
        deleteLocalImageFiles(image.publicId).catch((error) => {
          console.error(
            `Failed to delete local image ${image.publicId}:`,
            error
          );
          // Continue with property deletion even if image deletion fails
        })
      );

      await Promise.allSettled(deletePromises);
      console.log(
        `🗑️ Attempted to delete ${property.images.length} images from local storage`
      );
    }

    // Delete property from database
    await Property.findByIdAndDelete(property._id);

    res.status(200).json({
      success: true,
      message: `Property deleted successfully along with ${
        property.images?.length || 0
      } images`,
    });
  } catch (error) {
    console.error("Error deleting property:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete property",
    });
  }
};

/**
 * Delete specific image from property
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deletePropertyImage = async (req, res) => {
  try {
    const { id, imageId } = req.params;

    // Find property
    let property;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      property = await Property.findById(id);
    } else {
      property = await Property.findOne({ slug: id });
    }

    if (!property) {
      return res.status(404).json({
        success: false,
        error: "Property not found",
      });
    }

    // Check ownership for admin users (SuperAdmin can manage any property images)
    if (req.requireOwnership && req.userRole === "admin") {
      const ownerId = property.createdBy?.toString();
      if (ownerId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error:
            "Access denied - You can only manage images of properties you created",
        });
      }
    }

    // Find image to delete
    const imageIndex = property.images.findIndex(
      (img) => img._id.toString() === imageId
    );
    if (imageIndex === -1) {
      return res.status(404).json({
        success: false,
        error: "Image not found",
      });
    }

    const imageToDelete = property.images[imageIndex];

    // Delete from local storage
    try {
      await deleteLocalImageFiles(imageToDelete.publicId);
      console.log(
        `✅ Successfully deleted local files for image: ${imageToDelete.publicId}`
      );
    } catch (error) {
      console.error("Failed to delete image from local storage:", error);
      // Continue with database deletion even if local file deletion fails
    }

    // Remove from property
    property.images.splice(imageIndex, 1);

    // If deleted image was main and there are other images, set first as main
    if (imageToDelete.isMain && property.images.length > 0) {
      property.images[0].isMain = true;
    }

    await property.save();

    res.status(200).json({
      success: true,
      message: "Image deleted successfully",
      data: { property },
    });
  } catch (error) {
    console.error("Error deleting property image:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete image",
    });
  }
};

/**
 * Set image as main property image
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const setMainPropertyImage = async (req, res) => {
  try {
    const { id, imageId } = req.params;

    // Find property
    let property;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      property = await Property.findById(id);
    } else {
      property = await Property.findOne({ slug: id });
    }

    if (!property) {
      return res.status(404).json({
        success: false,
        error: "Property not found",
      });
    }

    // Check ownership for admin users (SuperAdmin can manage any property images)
    if (req.requireOwnership && req.userRole === "admin") {
      const ownerId = property.createdBy?.toString();
      if (ownerId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error:
            "Access denied - You can only manage images of properties you created",
        });
      }
    }

    // Find image to set as main
    const imageIndex = property.images.findIndex(
      (img) => img._id.toString() === imageId
    );
    if (imageIndex === -1) {
      return res.status(404).json({
        success: false,
        error: "Image not found",
      });
    }

    // Update main image
    property.images.forEach((img, index) => {
      img.isMain = index === imageIndex;
    });

    await property.save();

    res.status(200).json({
      success: true,
      message: "Main image updated successfully",
      data: { property },
    });
  } catch (error) {
    console.error("Error setting main property image:", error);
    res.status(500).json({
      success: false,
      error: "Failed to set main image",
    });
  }
};

module.exports = {
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
};
