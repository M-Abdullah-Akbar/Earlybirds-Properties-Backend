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
 * Helper function to get valid status transitions
 * This mirrors the frontend logic for consistency
 */
const getValidStatusTransitions = (
  currentStatus,
  previousStatus = undefined
) => {
  switch (currentStatus) {
    case "draft":
      // From draft: can only go to available (or stay draft)
      return ["draft", "available"];
    case "available":
      // From available: can select any other status
      return ["available", "pending", "sold", "rented", "archived"];
    case "pending":
      // From pending: can select any other status
      return ["pending", "available", "sold", "rented", "archived"];
    case "sold":
    case "rented":
      // From sold or rented: can only select archived (or keep current)
      return [currentStatus, "archived"];
    case "archived":
      // From archived: can only go back to the previous status
      const baseOptions = ["archived"];

      if (previousStatus) {
        // If we know the previous status, allow going back to it only
        if (!baseOptions.includes(previousStatus)) {
          baseOptions.push(previousStatus);
        }
      } else {
        // This should not happen in normal flow since properties always have status history
        // But if it does, we'll only allow staying archived to prevent invalid transitions
        console.warn(
          "⚠️ Archived property found without previousStatus - this should not happen"
        );
      }

      return baseOptions;
    default:
      // Default: all except draft
      return ["pending", "available", "sold", "rented", "archived"];
  }
};

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

    console.log(
      `🗑️ DELETE DEBUG - Attempting to delete files for publicId: ${publicId}`
    );
    console.log(`🗑️ DELETE DEBUG - Upload directory: ${uploadDir}`);

    // Extract base filename without extension if publicId already includes extension
    let baseFilename = publicId;
    const knownExtensions = [".webp", ".jpg", ".jpeg", ".png"];
    const hasExtension = knownExtensions.some((ext) =>
      publicId.toLowerCase().endsWith(ext)
    );

    if (hasExtension) {
      // Remove extension to get base filename
      const lastDotIndex = publicId.lastIndexOf(".");
      baseFilename = publicId.substring(0, lastDotIndex);
      console.log(
        `🗑️ DELETE DEBUG - PublicId has extension, using base: ${baseFilename}`
      );
    }

    // List of possible file extensions and sizes
    const possibleFiles = [
      `${baseFilename}.webp`,
      `${baseFilename}_thumb.webp`,
      `${baseFilename}_medium.webp`,
      `${baseFilename}_large.webp`,
      `${baseFilename}_original.webp`,
      `${baseFilename}.jpg`,
      `${baseFilename}.jpeg`,
      `${baseFilename}.png`,
    ];

    // If publicId already had extension, also try the original filename as-is
    if (hasExtension && !possibleFiles.includes(publicId)) {
      possibleFiles.push(publicId);
    }

    let deletedCount = 0;
    const deletionPromises = possibleFiles.map(async (filename) => {
      const filePath = path.join(uploadDir, filename);
      try {
        await fs.access(filePath); // Check if file exists
        await fs.unlink(filePath); // Delete the file
        console.log(`🗑️ DELETE DEBUG - Successfully deleted: ${filename}`);
        deletedCount++;
      } catch (error) {
        // File doesn't exist or couldn't be deleted
        console.log(
          `🗑️ DELETE DEBUG - File not found or couldn't delete: ${filename}`
        );
      }
    });

    await Promise.all(deletionPromises);
    console.log(
      `🗑️ DELETE DEBUG - Total files deleted for ${publicId}: ${deletedCount}`
    );
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
      approvalStatus,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Start with ACL query filters (set by ACL middleware based on user role)
    const filter = { ...req.queryFilters } || {};

    // Handle status filter based on user role
    const userRole = req.userRole || "visitor";

    // Apply approval status filtering based on user role
    if (userRole === "SuperAdmin") {
      // SuperAdmin can see all non-draft properties regardless of approval status
      // ACL middleware already excludes draft properties
      // No additional filtering needed
    } else if (userRole === "admin") {
      // Admin can see their own properties (all approval statuses)
      // ACL middleware already filters to own properties via createdBy
      // No additional approval status filtering needed for own properties
    } else {
      // Visitors can only see approved properties
      filter.approvalStatus = "approved";
    }

    // Handle listing status filter
    if (status) {
      if (userRole === "admin" || userRole === "SuperAdmin") {
        // Admin and SuperAdmin can filter by any status
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

    // Handle approval status filter for admin users
    if (approvalStatus && (userRole === "admin" || userRole === "SuperAdmin")) {
      // Override the default approval status filtering with user's specific choice
      if (
        approvalStatus === "pending" ||
        approvalStatus === "approved" ||
        approvalStatus === "rejected" ||
        approvalStatus === "not_applicable"
      ) {
        // Remove any existing approval status filters
        delete filter.approvalStatus;
        delete filter.$or;

        // Apply the specific approval status filter
        filter.approvalStatus = approvalStatus;

        // For admin users, also ensure they can only see their own properties or approved ones
        if (userRole === "admin" && req.user && req.user.id) {
          if (approvalStatus === "approved") {
            // For approved properties, admin can see all approved properties
            filter.approvalStatus = "approved";
          } else {
            // For pending/rejected, admin can only see their own
            filter.$and = [
              { approvalStatus: approvalStatus },
              { createdBy: req.user.id },
            ];
            delete filter.approvalStatus; // Remove the direct filter since we're using $and
          }
        }
      }
    }

    // Handle search filter
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { title: searchRegex },
          { description: searchRegex },
          { "location.address": searchRegex },
          { "location.area": searchRegex },
          { "location.emirate": searchRegex },
        ],
      });
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

    // Set approval status based on property status and user role
    // Draft properties should not be in approval workflow
    if (propertyData.status === "draft") {
      propertyData.approvalStatus = "not_applicable"; // Draft properties are not in approval workflow
    } else {
      // SuperAdmin properties are automatically approved, others need approval
      if (req.user.role === "SuperAdmin") {
        propertyData.approvalStatus = "approved"; // SuperAdmin properties are auto-approved
        propertyData.approvedBy = req.user.id; // Set who approved it
        propertyData.approvedAt = new Date(); // Set when it was approved
      } else {
        propertyData.approvalStatus = "pending"; // Non-draft properties need approval
      }
    }

    // Handle images from either uploaded files or pre-processed data
    let imageSource = null;
    let imageData = [];

    if (req.uploadedImages && req.uploadedImages.length > 0) {
      // Images were just uploaded via file upload
      imageSource = "uploaded";
      imageData = req.uploadedImages;
    } else if (
      req.body.images &&
      Array.isArray(req.body.images) &&
      req.body.images.length > 0
    ) {
      // Images were provided as pre-processed data
      imageSource = "pre-processed";
      imageData = req.body.images;
    } else {
      return res.status(400).json({
        success: false,
        error:
          "At least one property image is required. Either upload image files or provide pre-processed image data.",
      });
    }

    propertyData.images = imageData.map((image, index) => {
      return {
        url: image.url, // Use image URL
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
      message: `Property created successfully with ${propertyData.images.length} ${imageSource} images`,
    };

    // Add warnings if any exist
    if (req.validationWarnings && req.validationWarnings.length > 0) {
      response.warnings = req.validationWarnings;
    }

    res.status(201).json(response);
  } catch (error) {
    console.error("Error creating property with images:", error);

    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const value = error.keyValue[field];

      // Provide user-friendly error messages
      let userFriendlyField = field;
      let userFriendlyMessage = `${
        field.charAt(0).toUpperCase() + field.slice(1)
      } already exists`;

      if (field === "slug") {
        userFriendlyField = "title"; // Map slug errors to title field for frontend
        userFriendlyMessage =
          "A property with this title already exists. Please choose a different title.";
      }

      const errorResponse = {
        success: false,
        error: `Property with this ${
          field === "slug" ? "title" : field
        } already exists`,
        details: [
          {
            field: userFriendlyField,
            message: userFriendlyMessage,
          },
        ],
      };

      return res.status(400).json(errorResponse);
    }

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

      if (ownerId !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          error: "Access denied - You can only update properties you created",
        });
      }
    }

    // Property data is now parsed by middleware and available in req.body
    const propertyData = req.body;
    console.log("=== UPDATE PROPERTY DEBUG ===");
    console.log("Received emirate:", propertyData.location?.emirate);
    console.log(
      "Received area:",
      propertyData.location?.area,
      "(type:",
      typeof propertyData.location?.area,
      ")"
    );
    console.log("Existing emirate:", existingProperty.location?.emirate);
    console.log("Existing area:", existingProperty.location?.area);
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

      // Validate status transitions using the same logic as frontend
      const allowedStatuses = getValidStatusTransitions(
        currentStatus,
        existingProperty.previousStatus
      );

      if (!allowedStatuses.includes(newStatus)) {
        return res.status(400).json({
          success: false,
          error: `Invalid status transition: Cannot change status from '${currentStatus}' to '${newStatus}'`,
          details: {
            currentStatus,
            attemptedStatus: newStatus,
            allowedTransitions: allowedStatuses,
          },
        });
      }

      // Track previous status when archiving
      if (newStatus === "archived" && currentStatus !== "archived") {
        propertyData.previousStatus = currentStatus;
      }
      // Clear previous status when unarchiving
      else if (currentStatus === "archived" && newStatus !== "archived") {
        propertyData.previousStatus = undefined;
      }
    }

    const updateData = {
      ...propertyData,
      updatedBy: req.user.id,
      // updatedAt will be set automatically by the pre-save hook
    };

    // Handle approval status based on status changes and user role
    if (propertyData.status !== undefined) {
      const currentStatus = existingProperty.status;
      const newStatus = propertyData.status;

      // If changing FROM draft TO non-draft: needs approval (or auto-approve for SuperAdmin)
      if (currentStatus === "draft" && newStatus !== "draft") {
        if (req.user.role === "SuperAdmin") {
          updateData.approvalStatus = "approved"; // SuperAdmin properties are auto-approved
          updateData.approvedBy = req.user.id; // Set who approved it
          updateData.approvedAt = new Date(); // Set when it was approved
        } else {
          updateData.approvalStatus = "pending";
        }
        updateData.rejectionReason = null; // Clear any previous rejection reason
      }
      // If changing FROM non-draft TO draft: remove from approval workflow
      else if (currentStatus !== "draft" && newStatus === "draft") {
        updateData.approvalStatus = "not_applicable";
        updateData.rejectionReason = null; // Clear any previous rejection reason
      }
      // If staying non-draft and making other changes: reset to pending for re-approval (or auto-approve for SuperAdmin)
      else if (currentStatus !== "draft" && newStatus !== "draft") {
        // Only reset to pending if this is an admin making changes (SuperAdmin gets auto-approved)
        if (req.user.role === "admin") {
          updateData.approvalStatus = "pending";
          updateData.rejectionReason = null; // Clear any previous rejection reason
        } else if (req.user.role === "SuperAdmin") {
          updateData.approvalStatus = "approved"; // SuperAdmin properties are auto-approved
          updateData.approvedBy = req.user.id; // Set who approved it
          updateData.approvedAt = new Date(); // Set when it was approved
          updateData.rejectionReason = null; // Clear any previous rejection reason
        }
      }
      // If staying draft: keep current approval status (should be "not_applicable")
    } else {
      // If no status change but other property changes and not draft: reset to pending for admin (or auto-approve for SuperAdmin)
      if (existingProperty.status !== "draft") {
        if (req.user.role === "admin") {
          updateData.approvalStatus = "pending";
          updateData.rejectionReason = null; // Clear any previous rejection reason
        } else if (req.user.role === "SuperAdmin") {
          updateData.approvalStatus = "approved"; // SuperAdmin properties are auto-approved
          updateData.approvedBy = req.user.id; // Set who approved it
          updateData.approvedAt = new Date(); // Set when it was approved
          updateData.rejectionReason = null; // Clear any previous rejection reason
        }
      }
    }

    // Handle image updates (same approach as createProperty)
    let finalImages = [];
    let imageUpdateRequested = false;

    // Handle existing images that should be kept
    if (propertyData.existingImages !== undefined) {
      imageUpdateRequested = true;
      try {
        const existingImages = JSON.parse(propertyData.existingImages);
        if (Array.isArray(existingImages)) {
          finalImages = [...existingImages];
          console.log(`📷 Keeping ${existingImages.length} existing images`);
        }
      } catch (error) {
        console.error("❌ Error parsing existingImages:", error);
      }
    }

    // Handle new uploaded images
    if (req.uploadedImages && req.uploadedImages.length > 0) {
      imageUpdateRequested = true;
      console.log(`📷 Adding ${req.uploadedImages.length} new images`);

      const newImages = req.uploadedImages.map((image, index) => {
        // Get metadata from imageMetadata if available
        const metadata =
          req.imageMetadata && req.imageMetadata[index]
            ? req.imageMetadata[index]
            : {};

        return {
          url: image.url,
          publicId: image.publicId,
          altText:
            metadata.altText ||
            `Property image ${finalImages.length + index + 1}`,
          order: finalImages.length + index,
          isMain: metadata.isMain === "true" || metadata.isMain === true,
          originalName: image.originalName,
          size: image.size,
          format: image.format,
          width: image.width,
          height: image.height,
        };
      });

      finalImages = [...finalImages, ...newImages];
    }

    // Process images if any image update was requested
    if (imageUpdateRequested) {
      // Find images that were removed and delete them from local storage
      const currentImageIds = existingProperty.images.map(
        (img) => img.publicId
      );
      const finalImageIds = finalImages.map((img) => img.publicId);
      const removedImageIds = currentImageIds.filter(
        (id) => !finalImageIds.includes(id)
      );

      if (removedImageIds.length > 0) {
        console.log(
          `🗑️ UPDATE DEBUG - Found ${removedImageIds.length} images to delete:`,
          removedImageIds
        );

        // Delete removed images from local storage
        const deletePromises = removedImageIds.map(async (publicId) => {
          try {
            await deleteLocalImageFiles(publicId);
            console.log(
              `✅ Successfully deleted local files for removed image: ${publicId}`
            );
          } catch (error) {
            console.error(
              `❌ Failed to delete local files for image ${publicId}:`,
              error
            );
            // Continue with update even if image deletion fails
          }
        });

        await Promise.allSettled(deletePromises);
      }

      // Ensure only one image is marked as main
      if (finalImages.length > 0) {
        const mainImages = finalImages.filter((img) => img.isMain);
        if (mainImages.length > 1) {
          // If multiple images are marked as main, keep only the first one
          let foundMain = false;
          finalImages = finalImages.map((img) => {
            if (img.isMain && !foundMain) {
              foundMain = true;
              return img;
            } else if (img.isMain && foundMain) {
              return { ...img, isMain: false };
            }
            return img;
          });
        } else if (mainImages.length === 0) {
          // If no image is marked as main, mark the first one as main
          finalImages[0].isMain = true;
        }

        // Update order to be sequential
        finalImages = finalImages.map((img, index) => ({
          ...img,
          order: index,
        }));
      }

      // Validate that at least one image remains after update
      if (finalImages.length === 0) {
        return res.status(400).json({
          success: false,
          error: "At least one image is required",
          details: [
            {
              field: "images",
              message: "At least one image is required",
            },
          ],
        });
      }

      updateData.images = finalImages;
      console.log(
        `📷 Image update requested - Final images count: ${finalImages.length}`
      );
    } else {
      // If no image data is provided at all, keep existing images unchanged
      console.log("📷 No image changes requested, keeping existing images");
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

    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const value = error.keyValue[field];

      // Provide user-friendly error messages
      let userFriendlyField = field;
      let userFriendlyMessage = `${
        field.charAt(0).toUpperCase() + field.slice(1)
      } already exists`;

      if (field === "slug") {
        userFriendlyField = "title"; // Map slug errors to title field for frontend
        userFriendlyMessage =
          "A property with this title already exists. Please choose a different title.";
      }

      const errorResponse = {
        success: false,
        error: `Property with this ${
          field === "slug" ? "title" : field
        } already exists`,
        details: [
          {
            field: userFriendlyField,
            message: userFriendlyMessage,
          },
        ],
      };

      return res.status(400).json(errorResponse);
    }

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
      if (ownerId !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          error: "Access denied - You can only delete properties you created",
        });
      }

      // Admin can only delete rejected or draft properties
      const canDelete =
        property.approvalStatus === "rejected" || property.status === "draft";
      if (!canDelete) {
        return res.status(403).json({
          success: false,
          error: `Cannot delete property. Only rejected or draft properties can be deleted by admin.`,
          details: {
            currentStatus: property.status,
            currentApprovalStatus: property.approvalStatus,
            allowedConditions:
              "status = 'draft' OR approvalStatus = 'rejected'",
            message:
              property.approvalStatus === "pending"
                ? "Property is awaiting SuperAdmin approval"
                : property.approvalStatus === "approved"
                ? "Property has been approved and cannot be deleted"
                : "Property is not in a deletable state",
          },
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
