const { body, query, param, validationResult } = require("express-validator");
const multer = require("multer");
const {
  EMIRATE_AREA_MAP,
  PROPERTY_TYPE_AMENITIES_MAP,
  PROPERTY_STATUS,
  EMIRATES,
  PROPERTY_TYPES,
  LISTING_TYPES,
} = require("../constants/propertyTypes");

const { validateImageUrl } = require("./localImageValidation");

/**
 * Middleware to handle validation errors
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  console.log(
    "🔍 Checking validation errors:",
    errors.isEmpty() ? "No errors" : "Has errors"
  );

  if (!errors.isEmpty()) {
    console.log("❌ Validation errors found:", errors.array());
    const errorMessages = errors.array().map((error) => ({
      field: error.path,
      message: error.msg,
      value: error.value,
    }));

    return res.status(400).json({
      success: false,
      error: "Validation failed",
      details: errorMessages,
    });
  }

  console.log("✅ All validations passed");
  next();
};

/**
 * Custom validation function for login endpoint
 */
const validateLogin = [
  body("username").custom((username, { req }) => {
    // Check if username is provided
    if (!username || username.trim() === "") {
      throw new Error("Username is required");
    } // Trim the username
    else {
      username = username.trim();
      // Check length
      if (username.length < 3) {
        throw new Error("Username must be at least 3 characters long");
      } else if (username.length > 50) {
        throw new Error("Username cannot exceed 50 characters");
      } // Check format - only allow letters, numbers, and underscores
      else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        throw new Error(
          "Username can only contain letters, numbers, and underscores"
        );
      } // Update the request body with the trimmed username
      else {
        req.body.username = username;
        return true;
      }
    }
  }),

  body("password").custom((password, { req }) => {
    return validatePasswordHelper(password, "login");
  }),

  handleValidationErrors,
];

/**
 * Helper function to validate password with dynamic error messages
 * @param {string} password - The password to validate
 * @param {string} type - Type of password ("current", "new", or "login")
 * @returns {boolean} - Returns true if valid, throws error if invalid
 */
const validatePasswordHelper = (password, type = "new") => {
  let passwordType, maxLengthMessage;

  if (type === "current") {
    passwordType = "Current password";
    maxLengthMessage = "Current password cannot exceed 128 characters";
  } else if (type === "login") {
    passwordType = "Password";
    maxLengthMessage = "Password cannot exceed 128 characters";
  } else {
    passwordType = "New password";
    maxLengthMessage = "New password cannot exceed 128 characters";
  }

  // Check if password is provided
  if (!password || password.trim() === "") {
    throw new Error(`${passwordType} is required`);
  } // Check minimum length
  else if (password.length < 8) {
    throw new Error(`${passwordType} must be at least 8 characters long`);
  } // Check maximum length for security
  else if (password.length > 128) {
    throw new Error(maxLengthMessage);
  } // Check for lowercase letter
  else if (!/(?=.*[a-z])/.test(password)) {
    throw new Error(
      `${passwordType} must contain at least one lowercase letter`
    );
  } // Check for uppercase letter
  else if (!/(?=.*[A-Z])/.test(password)) {
    throw new Error(
      `${passwordType} must contain at least one uppercase letter`
    );
  } // Check for number
  else if (!/(?=.*\d)/.test(password)) {
    throw new Error(`${passwordType} must contain at least one number`);
  } // Check for special character
  else if (!/(?=.*[@$!%*?&])/.test(password)) {
    throw new Error(
      `${passwordType} must contain at least one special character (@$!%*?&)`
    );
  } else {
    return true;
  }
};

/**
 * Validation rules for change password endpoint
 */
const validateChangePassword = [
  body("currentPassword").custom((currentPassword, { req }) => {
    return validatePasswordHelper(currentPassword, "current");
  }),

  body("newPassword").custom((newPassword, { req }) => {
    // Use helper function for standard password validation
    validatePasswordHelper(newPassword, "new");

    // Additional check: new password must be different from current password
    if (newPassword === req.body.currentPassword) {
      throw new Error("New password must be different from current password");
    } else {
      return true;
    }
  }),

  body("confirmPassword").custom((confirmPassword, { req }) => {
    // Check if confirm password is provided
    if (!confirmPassword || confirmPassword.trim() === "") {
      throw new Error("Please confirm your new password");
    } // Check if passwords match
    else if (confirmPassword !== req.body.newPassword) {
      throw new Error("Password do not match");
    } else {
      return true;
    }
  }),

  handleValidationErrors,
];

/**
 * Sanitize request body to prevent XSS and injection attacks
 * Note: Password fields are excluded from aggressive sanitization
 */
const sanitizeInput = (req, res, next) => {
  if (req.body) {
    // Fields that should not be aggressively sanitized (passwords, etc.)
    const excludeFields = [
      "password",
      "currentPassword",
      "newPassword",
      "confirmPassword",
    ];

    Object.keys(req.body).forEach((key) => {
      if (typeof req.body[key] === "string" && !excludeFields.includes(key)) {
        // Remove HTML tags for non-password fields
        req.body[key] = req.body[key].replace(/<[^>]*>/g, "");

        // Only remove obvious script tags and dangerous patterns, not quotes/semicolons
        req.body[key] = req.body[key].replace(
          /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
          ""
        );
        req.body[key] = req.body[key].replace(/javascript:/gi, "");
        req.body[key] = req.body[key].replace(/on\w+\s*=/gi, "");

        // Trim whitespace
        req.body[key] = req.body[key].trim();
      } else if (typeof req.body[key] === "string") {
        // For password fields, only trim whitespace
        console.log(`ðŸ” Trimming password field: ${key}`);
        req.body[key] = req.body[key].trim();
      }
    });
  }
  next();
};

/**
 * Validate request size and structure
 */
const validateRequestStructure = (req, res, next) => {
  // Check for unexpected fields in login
  if (req.path === "/login") {
    const allowedFields = ["username", "password"];
    const requestFields = Object.keys(req.body);
    const unexpectedFields = requestFields.filter(
      (field) => !allowedFields.includes(field)
    );

    if (unexpectedFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Unexpected fields in request",
        unexpectedFields,
      });
    }
  } // Check for unexpected fields in change password
  else if (req.path === "/change-password") {
    const allowedFields = ["currentPassword", "newPassword", "confirmPassword"];
    const requestFields = Object.keys(req.body);
    const unexpectedFields = requestFields.filter(
      (field) => !allowedFields.includes(field)
    );

    if (unexpectedFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Unexpected fields in request",
        unexpectedFields,
      });
    }
  }
  next();
};

/**
 * Middleware to clean up null parking fields before validation
 */
const cleanupParkingFields = (req, res, next) => {
  console.log("🚗 PARKING DEBUG - Raw request body parking data:");
  console.log(
    "Full parking object:",
    JSON.stringify(req.body.details?.parking, null, 2)
  );

  if (req.body.details && req.body.details.parking) {
    const parking = req.body.details.parking;

    console.log("🚗 PARKING DEBUG - Individual fields:");
    console.log(
      "parking.available:",
      parking.available,
      "(type:",
      typeof parking.available,
      ")"
    );
    console.log(
      "parking.type:",
      parking.type,
      "(type:",
      typeof parking.type,
      ")"
    );
    console.log(
      "parking.spaces:",
      parking.spaces,
      "(type:",
      typeof parking.spaces,
      ")"
    );

    // If parking.available is null, undefined, or false, remove parking fields that are null
    if (!parking.available) {
      console.log(
        "🚗 PARKING DEBUG - Parking not available, cleaning up fields"
      );
      if (
        parking.type === null ||
        parking.type === undefined ||
        parking.type === ""
      ) {
        console.log("🚗 PARKING DEBUG - Removing parking.type");
        delete req.body.details.parking.type;
      }
      if (parking.spaces === null || parking.spaces === undefined) {
        console.log("🚗 PARKING DEBUG - Removing parking.spaces");
        delete req.body.details.parking.spaces;
      }
    } else {
      console.log(
        "🚗 PARKING DEBUG - Parking is available, keeping all fields"
      );
    }

    console.log("🚗 PARKING DEBUG - After cleanup:");
    console.log(
      "Final parking object:",
      JSON.stringify(req.body.details?.parking, null, 2)
    );
  } else {
    console.log("🚗 PARKING DEBUG - No parking data found in request");
  }

  next();
};

/**
 * Validation rules for creating properties
 */
const validateCreateProperty = [
  // Basic property information
  body("title")
    .custom((title, { req }) => {
      // Check if title is required (empty string check)
      if (title === "") {
        throw new Error("Property title is required");
      }
      title = title.trim();

      // Length validation
      if (title.length < 5) {
        throw new Error("Title must be at least 5 characters long");
      } else if (title.length > 200) {
        throw new Error("Title cannot exceed 200 characters");
      } // Check for meaningful content (not just spaces/special chars)
      else if (!/[a-zA-Z]/.test(title)) {
        throw new Error("Title must contain at least some letters");
      } // Update the request body with the trimmed title
      req.body.title = title;
      return true;
    })
    .custom(async (title, { req }) => {
      // Check for duplicate titles excluding the current property
      const Property = require("../models/Property");
      const propertyId = req.params.id;

      let query = { title: title };

      // Exclude current property from duplicate check
      if (propertyId) {
        // Handle both ObjectId and slug formats
        if (propertyId.match(/^[0-9a-fA-F]{24}$/)) {
          query._id = { $ne: propertyId };
        } else {
          query.slug = { $ne: propertyId };
        }
      }

      const existing = await Property.findOne(query);
      if (existing) {
        throw new Error(
          "A property with this title already exists. Please use a unique title."
        );
      }
      return true;
    }),

  body("description").custom((description, { req }) => {
    // Check if description is required (empty string check)
    if (description === "") {
      throw new Error("Property description is required");
    } // Trim the description
    description = description.trim();

    // Length validation
    if (description.length < 200) {
      throw new Error("Description must be at least 200 characters long");
    } else if (description.length > 10000) {
      throw new Error("Description cannot exceed 10000 characters");
    } // Update the request body with the trimmed description
    req.body.description = description;
    return true;
  }),

  // Property type validation
  body("propertyType").custom((propertyType, { req }) => {
    // Check if propertyType is null or undefined
    if (propertyType == "") {
      throw new Error("Property type is required");
    } // Must be string
    else if (typeof propertyType !== "string") {
      throw new Error("Property type must be a string");
    } // Format validation
    else if (
      !/^[a-zA-Z0-9\s-]+$/.test(propertyType) ||
      propertyType.trim() !== propertyType ||
      propertyType.includes("  ")
    ) {
      throw new Error(
        `Invalid property type format: "${propertyType}". Must contain only letters, numbers, spaces, and hyphens, with no leading/trailing spaces.`
      );
    } else {
      return true;
    }
  }),

  body("price").custom((price, { req }) => {
    // Skip price validation for "off plan" listing type
    if (req.body.listingType === "off plan") {
      return true;
    }

    // Check if price is required (null, undefined, empty string, or string "NaN")
    if (
      price === null ||
      price === undefined ||
      price === "" ||
      price === "NaN"
    ) {
      throw new Error("Price is required");
    }

    // Convert to number and validate it's a positive float
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      throw new Error("Price must be a positive number");
    }

    // Update the request body with the parsed number
    req.body.price = numPrice;

    return true;
  }),

  // Location validation

  body("location.address").custom((address, { req }) => {
    // Check if address is required (empty string check)
    if (!address || address.trim() === "") {
      throw new Error("Address is required");
    }

    // Trim the address
    address = address.trim();

    // Length validation
    if (address.length < 5) {
      throw new Error("Address must be at least 5 characters long");
    } else if (address.length > 200) {
      throw new Error("Address cannot exceed 200 characters");
    }

    // Update the request body with the trimmed address
    req.body.location.address = address;
    return true;
  }),

  body("location.emirate").notEmpty().withMessage("Emirate is required"),

  body("location.area").custom((value, { req }) => {
    // Check if area is required (empty string check)
    if (value === "") {
      throw new Error("Location area is required");
    }

    const emirate = req.body.location?.emirate;
    if (!emirate) {
      throw new Error("Emirate must be selected before area");
    }
    return true;
  }),

  // Property details validation

  body("details.bedrooms").custom((bedrooms, { req }) => {
    const propertyType = req.body.propertyType;

    // For studio and office property types, bedrooms should not be provided
    if (propertyType === "studio" || propertyType === "office") {
      // If bedrooms field exists (not null and not undefined), reject it
      if (bedrooms !== null && bedrooms !== undefined && bedrooms !== "") {
        throw new Error(
          `Bedrooms field is not applicable for ${propertyType} property type. Please remove this field.`
        );
      }
      // If bedrooms is null or undefined (field not sent or explicitly null), that's perfectly fine
      return true;
    }

    // For all other property types, bedrooms are required
    if (bedrooms === null || bedrooms === undefined || bedrooms === "") {
      throw new Error("Number of bedrooms is required");
    }

    if (!Number.isInteger(Number(bedrooms)) || Number(bedrooms) < 0) {
      throw new Error("Bedrooms must be a non-negative integer");
    }

    return true;
  }),

  body("details.bathrooms").custom((bathrooms, { req }) => {
    // Check if bathrooms is required (empty string check)
    if (bathrooms === null || bathrooms === undefined) {
      throw new Error("Number of bathrooms is required");
    }

    // Convert to number and validate it's a non-negative integer
    const numBathrooms = parseInt(bathrooms);
    if (
      isNaN(numBathrooms) ||
      numBathrooms < 0 ||
      !Number.isInteger(Number(bathrooms))
    ) {
      throw new Error("Bathrooms must be a non-negative integer");
    }

    // Update the request body with the parsed number
    req.body.details.bathrooms = numBathrooms;

    return true;
  }),

  body("details.area").custom((area, { req }) => {
    // Check if area is required (empty string check)
    if (area === null || area === undefined) {
      throw new Error("Property area is required");
    }

    // Convert to number and validate it's a positive float
    const numArea = parseFloat(area);
    if (isNaN(numArea) || numArea <= 0) {
      throw new Error("Property area must be a positive number");
    }

    // Update the request body with the parsed number
    req.body.details.area = numArea;

    return true;
  }),

  body("details.totalFloors").custom((totalFloors, { req }) => {
    // If totalFloors is not provided (null, undefined, empty string), it's optional
    if (totalFloors === null || totalFloors === undefined) {
      return true;
    }

    // If provided, validate that it's a positive integer
    if (!Number.isInteger(Number(totalFloors)) || Number(totalFloors) <= 0) {
      throw new Error("Total floors must be a positive integer greater than 0");
    }

    return true;
  }),

  body("details.floorLevel").custom((floorLevel, { req }) => {
    const propertyType = req.body.propertyType;

    // For villa, townhouse, and penthouse property types, floorLevel should NOT be provided
    if (propertyType === "villa" || propertyType === "townhouse") {
      // If floorLevel field exists (not null/undefined) and has a value, reject it
      if (floorLevel !== undefined && floorLevel !== "") {
        throw new Error(
          `Floor level field is not applicable for ${propertyType} property type. Please remove this field.`
        );
      }
      // If floorLevel is null/undefined/empty, that's perfectly fine
      return true;
    }

    // For all other property types, floorLevel is optional
    // No additional validation needed for floorLevel as it's a text field
    return true;
  }),

  body("details.landArea").custom((landArea, { req }) => {
    const propertyType = req.body.propertyType;

    // For apartment, penthouse, and studio property types, landArea should NOT be provided
    if (
      propertyType === "apartment" ||
      propertyType === "penthouse" ||
      propertyType === "studio"
    ) {
      // If landArea field exists (not null/undefined) and has a value, reject it
      if (landArea !== null && landArea !== undefined && landArea !== "") {
        throw new Error(
          `Land area field is not applicable for ${propertyType} property type. Please remove this field.`
        );
      }
      // If landArea is null or undefined (field not sent or explicitly null), that's perfectly fine
      return true;
    }

    // For villa, townhouse, and office property types, landArea is optional
    if (landArea === null || landArea === undefined || landArea === "") {
      return true;
    }

    const numLandArea = parseFloat(landArea);
    if (isNaN(numLandArea) || numLandArea < 0) {
      throw new Error("Land area must be a positive number");
    }

    // Update the request body with the parsed number
    req.body.details.landArea = numLandArea;

    return true;
  }),

  body("details.yearBuilt").custom((yearBuilt) => {
    // If yearBuilt is not provided (null, undefined, empty string), it's optional
    if (yearBuilt === null || yearBuilt === "" || yearBuilt === undefined) {
      return true;
    }

    // If provided, validate the range
    const currentYear = new Date().getFullYear();
    const minYear = 1990;
    const maxYear = currentYear + 2;

    if (
      !Number.isInteger(Number(yearBuilt)) ||
      Number(yearBuilt) < minYear ||
      Number(yearBuilt) > maxYear
    ) {
      throw new Error(`Year built must be between ${minYear} and ${maxYear}`);
    }

    return true;
  }),

  // Amenities validation
  body("amenities")
    .optional({ nullable: true, checkFalsy: true })
    .if(body("amenities").exists())
    .isArray()
    .withMessage("Amenities must be an array")
    .custom(async (amenities, { req }) => {
      // Additional safety check
      if (!amenities || !Array.isArray(amenities)) {
        return true;
      }

      if (amenities.length > 50) {
        throw new Error("Cannot have more than 50 amenities");
      }

      // Check for duplicates
      const uniqueAmenities = Array.from(new Set(amenities));
      if (uniqueAmenities.length !== amenities.length) {
        throw new Error("Duplicate amenities are not allowed");
      }

      // Validate each amenity format
      for (const amenity of amenities) {
        // Must be string
        if (typeof amenity !== "string") {
          throw new Error(`Amenity must be a string: ${amenity}`);
        }

        // Format validation (allows custom amenities)
        if (
          !/^[a-zA-Z0-9\s-]{2,50}$/.test(amenity) ||
          amenity.trim() !== amenity ||
          amenity.includes("  ")
        ) {
          throw new Error(
            `Invalid amenity format: "${amenity}". Must be 2-50 characters, contain only letters, numbers, spaces, and hyphens, with no leading/trailing spaces.`
          );
        }
      }

      // Get property type from request body
      const propertyType = req.body.propertyType;

      // Validate amenities against property type if we have one
      if (propertyType) {
        const validAmenitiesForType = PROPERTY_TYPE_AMENITIES_MAP[propertyType];

        // Get all valid amenities across all property types
        const allValidAmenities = new Set();
        Object.values(PROPERTY_TYPE_AMENITIES_MAP).forEach((amenitiesList) => {
          amenitiesList.forEach((amenity) => {
            allValidAmenities.add(amenity.toLowerCase());
          });
        });

        const customAmenities = [];

        for (const amenity of amenities) {
          // Check if amenity is in the valid list for all property types (case-insensitive)
          const isGloballyValid = allValidAmenities.has(amenity.toLowerCase());

          if (isGloballyValid) {
            if (validAmenitiesForType) {
              // If it's globally valid, check whether it's valid for the specific property type
              const isValidForPropertyType = validAmenitiesForType.some(
                (validAmenity) =>
                  validAmenity.toLowerCase() === amenity.toLowerCase()
              );

              // If it's not valid for this specific property type, add it to customAmenities
              if (!isValidForPropertyType) {
                customAmenities.push(amenity);
              }
            } else {
              // If no valid amenities are defined for this property type, treat it as a custom amenity
              customAmenities.push(amenity);
            }
          } else {
            // If amenity is not globally valid (custom amenity), add to custom amenities list
            customAmenities.push(amenity);
          }
        }

        // Store warning for custom amenities (doesn't block the request)
        if (customAmenities.length > 0) {
          const warningMessage = `The following custom amenities are being used for property type ${propertyType}: ${customAmenities.join(
            ", "
          )}. These are not in the predefined list but will be accepted.`;

          // Store warning in request object for controller to access
          if (!req.validationWarnings) {
            req.validationWarnings = [];
          }
          req.validationWarnings.push({
            type: "custom_amenities",
            message: warningMessage,
            customAmenities: customAmenities,
          });
        }
      }

      return true;
    }),

  // Images validation - comprehensive validation for all image fields
  body("images").custom((images, { req }) => {
    // Check if images are provided (either as processed images or uploaded files)
    const hasUploadedFiles = req.files && req.files.length > 0;
    const hasProcessedImages =
      images && Array.isArray(images) && images.length > 0;

    if (!hasUploadedFiles && !hasProcessedImages) {
      throw new Error("At least one image is required");
    }

    // If we have uploaded files but no processed images, skip further validation
    // (images will be processed after validation passes)
    if (hasUploadedFiles && !hasProcessedImages) {
      return true;
    }

    // Check array length
    if (images.length > 10) {
      throw new Error("Must have between 1 and 10 images");
    }

    let mainImageCount = 0;
    const orders = [];
    const urls = [];
    const publicIds = [];

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const imageIndex = i + 1;

      // Required fields validation
      if (!image.url) {
        throw new Error(`Image ${imageIndex}: URL is required`);
      }

      if (!image.publicId) {
        throw new Error(`Image ${imageIndex}: Public ID is required`);
      }

      // URL format validation - handle both regular URLs and local URLs
      const urlRegex = /^https?:\/\/.+(\.(jpg|jpeg|png|webp)|\/[^\/]+)$/i;

      if (!urlRegex.test(image.url) && !validateImageUrl(image.url)) {
        throw new Error(
          `Image ${imageIndex}: URL must be a valid HTTP/HTTPS URL ending with jpg, jpeg, png, webp, or a valid local upload URL`
        );
      }

      if (image.publicId.length > 100) {
        throw new Error(
          `Image ${imageIndex}: Public ID cannot exceed 100 characters`
        );
      }

      // Order validation
      if (image.order !== undefined) {
        if (
          !Number.isInteger(image.order) ||
          image.order < 0 ||
          image.order > 10
        ) {
          throw new Error(
            `Image ${imageIndex}: Order must be an integer between 0 and 10`
          );
        }
        orders.push(image.order);
      }

      // isMain validation
      if (image.isMain === true) {
        mainImageCount++;
      }

      // Duplicate URL check
      if (urls.includes(image.url)) {
        throw new Error(`Image ${imageIndex}: Duplicate image URL found`);
      }
      urls.push(image.url);

      // Duplicate publicId check
      if (publicIds.includes(image.publicId)) {
        throw new Error(`Image ${imageIndex}: Duplicate public ID found`);
      }
      publicIds.push(image.publicId);

      // Alt text format validation (if provided)
      if (image.altText && image.altText.trim() !== image.altText) {
        throw new Error(
          `Image ${imageIndex}: Alt text cannot have leading or trailing spaces`
        );
      }

      // Public ID format validation (basic)
      if (!/^[a-zA-Z0-9_\-\/]+$/.test(image.publicId)) {
        throw new Error(
          `Image ${imageIndex}: Public ID can only contain letters, numbers, underscores, hyphens, and forward slashes`
        );
      }
    }

    // Business logic validations
    if (mainImageCount > 1) {
      throw new Error("Only one image can be marked as main image");
    }

    // If no main image is specified, the first image should be main
    if (mainImageCount === 0 && images.length > 0) {
      // This is just a warning - we can auto-set the first image as main
      // throw new Error("At least one image must be marked as main image");
    }

    // Check for duplicate orders (if orders are specified)
    const nonZeroOrders = orders.filter((order) => order > 0);
    const uniqueOrders = [...new Set(nonZeroOrders)];
    if (nonZeroOrders.length !== uniqueOrders.length) {
      throw new Error(
        "Duplicate image orders are not allowed (except for order 0)"
      );
    }

    return true;
  }),

  body("listingType").custom((listingType, { req }) => {
    // Check if listing type is provided
    if (!listingType) {
      throw new Error("Listing type is required");
    }

    const status = req.body.status;

    // Cross-validation with status
    if (status === "sold" && listingType !== "sale") {
      throw new Error("Only 'sale' properties can have 'sold' status");
    }
    if (status === "rented" && listingType !== "rent") {
      throw new Error("Only 'rent' properties can have 'rented' status");
    }

    return true;
  }),

  body("details.parking.type").custom((parkingType, { req }) => {
    const parkingAvailable = req.body.details?.parking?.available;

    // Convert string "true"/"false" to boolean for proper comparison
    const isParkingAvailable =
      parkingAvailable === true || parkingAvailable === "true";

    // If parking is available, type must be specified
    if (isParkingAvailable && (!parkingType || parkingType.trim() === "")) {
      throw new Error("Parking type is required when parking is available");
    } // If parking is not available, type should not be specified
    else if (!isParkingAvailable && parkingType && parkingType.trim() !== "") {
      throw new Error(
        "Parking type should not be specified when parking is not available"
      );
    }
    return true;
  }),

  body("details.parking.spaces").custom((spaces, { req }) => {
    const parkingAvailable = req.body.details?.parking?.available;

    // Convert string "true"/"false" to boolean for proper comparison
    const isParkingAvailable =
      parkingAvailable === true || parkingAvailable === "true";

    // If parking is available, spaces must be > 0
    if (isParkingAvailable) {
      // Check if spaces is provided and valid
      if (spaces === null || spaces === undefined || spaces === "") {
        throw new Error(
          "Number of parking spaces is required when parking is available"
        );
      }

      // Convert to number and validate
      const numSpaces = parseInt(spaces);
      if (isNaN(numSpaces) || numSpaces <= 0) {
        throw new Error(
          "Number of parking spaces must be greater than 0 when parking is available"
        );
      }
    } // If parking is not available, spaces should not be specified
    else if (!isParkingAvailable && spaces && spaces !== "0" && spaces !== 0) {
      throw new Error(
        "Parking spaces should not be specified when parking is not available"
      );
    }
    return true;
  }),

  // Status validation for property creation
  body("status").custom((status, { req }) => {
    // If status is provided, validate it's appropriate for creation
    if (status) {
      const allowedCreateStatuses = ["draft", "available"];
      if (!allowedCreateStatuses.includes(status)) {
        throw new Error(
          `Invalid status for property creation. Only '${allowedCreateStatuses.join(
            "' or '"
          )}' are allowed when creating a new property.`
        );
      }
    } // If no status provided, it will default to "available" (first in PROPERTY_STATUS array)
    return true;
  }),

  cleanupParkingFields,
  handleValidationErrors,
];

/**
 * Validation rules for updating properties
 */
const validateUpdateProperty = [
  // Basic property information
  body("title")
    .custom((title, { req }) => {
      // Check if title is required (empty string check)
      if (title === "") {
        throw new Error("Property title is required");
      }
      title = title.trim();

      // Length validation
      if (title.length < 5) {
        throw new Error("Title must be at least 5 characters long");
      } else if (title.length > 200) {
        throw new Error("Title cannot exceed 200 characters");
      } // Check for meaningful content (not just spaces/special chars)
      else if (!/[a-zA-Z]/.test(title)) {
        throw new Error("Title must contain at least some letters");
      } // Update the request body with the trimmed title
      req.body.title = title;
      return true;
    })
    .custom(async (title, { req }) => {
      // Check for duplicate titles excluding the current property
      const Property = require("../models/Property");
      const propertyId = req.params.id;

      let query = { title: title };

      // Exclude current property from duplicate check
      if (propertyId) {
        // Handle both ObjectId and slug formats
        if (propertyId.match(/^[0-9a-fA-F]{24}$/)) {
          query._id = { $ne: propertyId };
        } else {
          query.slug = { $ne: propertyId };
        }
      }

      const existing = await Property.findOne(query);
      if (existing) {
        throw new Error(
          "A property with this title already exists. Please use a unique title."
        );
      }
      return true;
    }),

  body("description").custom((description, { req }) => {
    // Check if description is required (empty string check)
    if (description === "") {
      throw new Error("Property description is required");
    }

    // Trim the description
    description = description.trim();

    // Length validation
    if (description.length < 200) {
      throw new Error("Description must be at least 200 characters long");
    } else if (description.length > 10000) {
      throw new Error("Description cannot exceed 10000 characters");
    }

    // Update the request body with the trimmed description
    req.body.description = description;

    return true;
  }),

  // Property type validation
  body("propertyType").custom((propertyType, { req }) => {
    // Check if propertyType is null or undefined
    if (propertyType == "") {
      throw new Error("Property type is required");
    } // Must be string
    else if (typeof propertyType !== "string") {
      throw new Error("Property type must be a string");
    } // Format validation
    else if (
      !/^[a-zA-Z0-9\s-]+$/.test(propertyType) ||
      propertyType.trim() !== propertyType ||
      propertyType.includes("  ")
    ) {
      throw new Error(
        `Invalid property type format: "${propertyType}". Must contain only letters, numbers, spaces, and hyphens, with no leading/trailing spaces.`
      );
    }

    return true;
  }),

  body("price").custom((price, { req }) => {
    // Skip price validation for "off plan" listing type
    if (req.body.listingType === "off plan") {
      return true;
    }

    // Check if price is required (empty string check)
    if (price === null) {
      throw new Error("Price is required");
    }

    // Convert to number and validate it's a positive float
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      throw new Error("Price must be a positive number");
    }

    // Update the request body with the parsed number
    req.body.price = numPrice;

    return true;
  }),

  // Location validation

  body("location.address").custom((address, { req }) => {
    // Check if address is required (empty string check)
    if (!address || address.trim() === "") {
      throw new Error("Address is required");
    }

    // Trim the address
    address = address.trim();

    // Length validation
    if (address.length < 5) {
      throw new Error("Address must be at least 5 characters long");
    } else if (address.length > 200) {
      throw new Error("Address cannot exceed 200 characters");
    }

    // Update the request body with the trimmed address
    req.body.location.address = address;
    return true;
  }),

  body("location.emirate")
    .optional()
    .custom(async (emirate, { req }) => {
      // Skip validation if emirate is not being updated
      if (!emirate) {
        return true;
      }

      // Check if emirate is valid
      if (!EMIRATE_AREA_MAP[emirate]) {
        throw new Error(`Invalid emirate: ${emirate}`);
      }

      let area = req.body.location?.area;

      // If area is not being updated, get it from the existing property
      if (!area && req.params.id) {
        try {
          const Property = require("../models/Property");
          let existingProperty;

          // Handle both ObjectId and slug formats
          if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
            existingProperty = await Property.findById(req.params.id);
          } else {
            existingProperty = await Property.findOne({ slug: req.params.id });
          }

          if (existingProperty && existingProperty.location?.area) {
            area = existingProperty.location.area;

            // If the emirate is changing and we're using the existing area,
            // we need to check if the existing area is valid for the new emirate
            if (existingProperty.location?.emirate !== emirate) {
              // The emirate is changing, so validate the existing area against the new emirate
              const validAreasForEmirate = EMIRATE_AREA_MAP[emirate];
              const isValidArea = validAreasForEmirate.some(
                (validArea) => validArea.toLowerCase() === area.toLowerCase()
              );

              if (!isValidArea) {
                throw new Error(
                  `Cannot change emirate to "${emirate}" because the current area "${area}" is not valid for this emirate. Please select a valid area for ${emirate}.`
                );
              }
            }
          }
        } catch (error) {
          console.error(
            "Error fetching existing property for emirate validation:",
            error
          );
          // Continue without validation if we can't fetch the property
          return true;
        }
      }

      // If we have an area, validate it against the new emirate
      if (area) {
        const validAreasForEmirate = EMIRATE_AREA_MAP[emirate];
        const isValidArea = validAreasForEmirate.some(
          (validArea) => validArea.toLowerCase() === area.toLowerCase()
        );

        if (!isValidArea) {
          throw new Error(
            `Area "${area}" is not valid for emirate "${emirate}". Please select a valid area.`
          );
        }
      }

      return true;
    }),

  body("location.area").custom(async (area, { req }) => {
    // Check if area is required (empty string check)
    if (area === "") {
      throw new Error("Location area is required");
    }

    // Skip validation if area is not being updated (null/undefined)
    if (!area) {
      return true;
    }

    let emirate = req.body.location?.emirate;

    // If emirate is not being updated, get it from the existing property
    if (!emirate && req.params.id) {
      try {
        const Property = require("../models/Property");
        let existingProperty;

        // Handle both ObjectId and slug formats
        if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
          existingProperty = await Property.findById(req.params.id);
        } else {
          existingProperty = await Property.findOne({ slug: req.params.id });
        }

        if (existingProperty && existingProperty.location?.emirate) {
          emirate = existingProperty.location.emirate;
        }
      } catch (error) {
        console.error(
          "Error fetching existing property for area validation:",
          error
        );
        // Continue without validation if we can't fetch the property
        return true;
      }
    }

    if (!emirate) {
      throw new Error("Emirate must be selected before area");
    }

    const validAreasForEmirate = EMIRATE_AREA_MAP[emirate];
    if (!validAreasForEmirate) {
      throw new Error(`Invalid emirate: ${emirate}`);
    }

    // Check if the provided area exists in the valid areas for this emirate (case-insensitive)
    const isValidArea = validAreasForEmirate.some(
      (validArea) => validArea.toLowerCase() === area.toLowerCase()
    );

    if (!isValidArea) {
      throw new Error(`Area "${area}" is not valid for emirate "${emirate}".`);
    }

    return true;
  }),

  // Property details validation

  body("details.bedrooms").custom((bedrooms, { req }) => {
    const propertyType = req.body.propertyType;

    // For studio and office property types, bedrooms should not be provided
    if (propertyType === "studio" || propertyType === "office") {
      // If bedrooms field exists (not null and not undefined), reject it
      if (bedrooms !== "" && bedrooms !== null && bedrooms !== undefined) {
        throw new Error(
          `Bedrooms field is not applicable for ${propertyType} property type. Please remove this field.`
        );
      }
      // If bedrooms is null or undefined (field not sent or explicitly null), that's perfectly fine
      return true;
    } // For all other property types, bedrooms are required
    else if (bedrooms === null || bedrooms === undefined || bedrooms === "") {
      throw new Error("Number of bedrooms is required");
    } else if (!Number.isInteger(Number(bedrooms)) || Number(bedrooms) < 0) {
      throw new Error("Bedrooms must be a non-negative integer");
    }

    return true;
  }),

  body("details.bathrooms").custom((bathrooms, { req }) => {
    // Check if bathrooms is required (empty string check)
    if (bathrooms === null) {
      throw new Error("Number of bathrooms is required");
    }

    // Convert to number and validate it's a non-negative integer
    const numBathrooms = parseInt(bathrooms);
    if (
      isNaN(numBathrooms) ||
      numBathrooms < 0 ||
      !Number.isInteger(Number(bathrooms))
    ) {
      throw new Error("Bathrooms must be a non-negative integer");
    }

    // Update the request body with the parsed number
    req.body.details.bathrooms = numBathrooms;

    return true;
  }),

  body("details.area").custom((area, { req }) => {
    // Check if area is required (empty string check)
    if (area === null) {
      throw new Error("Property area is required");
    }

    // Convert to number and validate it's a positive float
    const numArea = parseFloat(area);
    if (isNaN(numArea) || numArea <= 0) {
      throw new Error("Property area must be a positive number");
    }

    // Update the request body with the parsed number
    req.body.details.area = numArea;

    return true;
  }),

  body("details.totalFloors").custom((totalFloors, { req }) => {
    // If totalFloors is not provided (null, undefined, empty string), it's optional
    if (
      totalFloors === "" ||
      totalFloors === null ||
      totalFloors === undefined
    ) {
      return true;
    } // If provided, validate that it's a positive integer
    else if (
      !Number.isInteger(Number(totalFloors)) ||
      Number(totalFloors) <= 0
    ) {
      throw new Error("Total floors must be a positive integer greater than 0");
    }

    return true;
  }),

  body("details.floorLevel").custom((floorLevel, { req }) => {
    const propertyType = req.body.propertyType;

    // For villa, townhouse, and penthouse property types, floorLevel should NOT be provided
    if (propertyType === "villa" || propertyType === "townhouse") {
      // If floorLevel field exists (not null/undefined) and has a value, reject it
      if (
        floorLevel !== "" &&
        floorLevel !== null &&
        floorLevel !== undefined
      ) {
        throw new Error(
          `Floor level field is not applicable for ${propertyType} property type. Please remove this field.`
        );
      }
      // If floorLevel is null/undefined/empty, that's perfectly fine
      return true;
    }

    // For all other property types, floorLevel is optional
    // No additional validation needed for floorLevel as it's a text field
    return true;
  }),

  body("details.landArea").custom((landArea, { req }) => {
    const propertyType = req.body.propertyType;

    // For apartment, penthouse, and studio property types, landArea should NOT be provided
    if (
      propertyType === "apartment" ||
      propertyType === "penthouse" ||
      propertyType === "studio"
    ) {
      // If landArea field exists (not null/undefined) and has a value, reject it
      if (landArea !== "" && landArea !== null && landArea !== undefined) {
        throw new Error(
          `Land area field is not applicable for ${propertyType} property type. Please remove this field.`
        );
      }
      // If landArea is null or undefined (field not sent or explicitly null), that's perfectly fine
      return true;
    } // For villa, townhouse, and office property types, landArea is optional
    else if (landArea === "" || landArea === undefined || landArea === null) {
      return true;
    }

    const numLandArea = parseFloat(landArea);
    if (isNaN(numLandArea) || numLandArea < 0) {
      throw new Error("Land area must be a positive number");
    }

    // Update the request body with the parsed number
    req.body.details.landArea = numLandArea;

    return true;
  }),

  body("details.yearBuilt").custom((yearBuilt) => {
    // If yearBuilt is not provided (null, undefined, empty string), it's optional
    if (yearBuilt === null || yearBuilt === "" || yearBuilt === undefined) {
      return true;
    }

    // If provided, validate the range
    const currentYear = new Date().getFullYear();
    const minYear = 1990;
    const maxYear = currentYear + 2;

    if (
      !Number.isInteger(Number(yearBuilt)) ||
      Number(yearBuilt) < minYear ||
      Number(yearBuilt) > maxYear
    ) {
      throw new Error(`Year built must be between ${minYear} and ${maxYear}`);
    }

    return true;
  }),

  // Amenities validation
  body("amenities")
    .optional({ nullable: true, checkFalsy: true })
    .if(body("amenities").exists())
    .isArray()
    .withMessage("Amenities must be an array")
    .custom((amenities, { req }) => {
      // Additional safety check
      if (!amenities || !Array.isArray(amenities)) {
        return true;
      }

      if (amenities.length > 50) {
        throw new Error("Cannot have more than 50 amenities");
      }

      // Check for duplicates
      const uniqueAmenities = Array.from(new Set(amenities));
      if (uniqueAmenities.length !== amenities.length) {
        throw new Error("Duplicate amenities are not allowed");
      }

      // Validate each amenity format
      for (const amenity of amenities) {
        // Must be string
        if (typeof amenity !== "string") {
          throw new Error(`Amenity must be a string: ${amenity}`);
        }

        // Format validation (allows custom amenities)
        if (
          !/^[a-zA-Z0-9\s-]{2,50}$/.test(amenity) ||
          amenity.trim() !== amenity ||
          amenity.includes("  ")
        ) {
          throw new Error(
            `Invalid amenity format: "${amenity}". Must be 2-50 characters, contain only letters, numbers, spaces, and hyphens, with no leading/trailing spaces.`
          );
        }
      }

      return true;
    }),

  // Images validation - comprehensive validation for all image fields
  body("images").custom((images, { req }) => {
    // For updates, check both the images field and the existingImages/uploadedImages combination
    let totalImages = 0;

    console.log("🔍 IMAGE VALIDATION DEBUG:");
    console.log("- req.body.existingImages:", req.body.existingImages);
    console.log(
      "- req.uploadedImages:",
      req.uploadedImages ? req.uploadedImages.length : "undefined"
    );
    console.log("- req.files:", req.files ? req.files.length : "undefined");
    console.log("- images parameter:", images ? images.length : images);

    // Count existing images that are being kept
    if (req.body.existingImages) {
      try {
        const parsedExistingImages = JSON.parse(req.body.existingImages);
        if (Array.isArray(parsedExistingImages)) {
          totalImages += parsedExistingImages.length;
          console.log("- Existing images count:", parsedExistingImages.length);
        }
      } catch (error) {
        throw new Error("Invalid existing images format");
      }
    }

    // Count new images being uploaded
    if (req.uploadedImages && Array.isArray(req.uploadedImages)) {
      totalImages += req.uploadedImages.length;
      console.log("- Uploaded images count:", req.uploadedImages.length);
    } else if (req.files && Array.isArray(req.files)) {
      // Count raw uploaded files (before processing) - validation runs before processValidatedImages
      totalImages += req.files.length;
      console.log("- Raw files count:", req.files.length);
    }

    console.log("- Total images:", totalImages);

    // If we have a direct images array (legacy format), use that instead
    if (images !== undefined) {
      // Image validation disabled
      // if (images.length === 0) {
      //   throw new Error("At least one image is required");
      // }
      totalImages = images.length;
    } else {
      // For the new format (existingImages + uploadedImages), check total
      // Image validation disabled
      // if (totalImages === 0) {
      //   throw new Error("At least one image is required");
      // }
    }

    // Use the images array if available, otherwise skip detailed validation
    // (detailed validation will happen in the controller after processing)
    if (images === undefined) {
      // Just check the total count for new format
      if (totalImages > 10) {
        throw new Error("Cannot have more than 10 images per property");
      }
      return true;
    }

    // If images field is provided but empty, it means user wants to remove all images
    // Image validation disabled - allowing empty images
    // if (images.length === 0) {
    //   throw new Error("At least one image is required");
    // }

    // Check array length
    if (images.length > 10) {
      throw new Error("Must have between 1 and 10 images");
    }

    let mainImageCount = 0;
    const orders = [];
    const urls = [];
    const publicIds = [];

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const imageIndex = i + 1;

      // Required fields validation
      if (!image.url) {
        throw new Error(`Image ${imageIndex}: URL is required`);
      }

      if (!image.publicId) {
        throw new Error(`Image ${imageIndex}: Public ID is required`);
      }

      // URL format validation - handle both regular URLs and local URLs
      const urlRegex = /^https?:\/\/.+(\.(jpg|jpeg|png|webp)|\/[^\/]+)$/i;

      if (!urlRegex.test(image.url) && !validateImageUrl(image.url)) {
        throw new Error(
          `Image ${imageIndex}: URL must be a valid HTTP/HTTPS URL ending with jpg, jpeg, png, webp, or a valid local upload URL`
        );
      }

      if (image.publicId.length > 100) {
        throw new Error(
          `Image ${imageIndex}: Public ID cannot exceed 100 characters`
        );
      }

      // Order validation
      if (image.order !== undefined) {
        if (
          !Number.isInteger(image.order) ||
          image.order < 0 ||
          image.order > 10
        ) {
          throw new Error(
            `Image ${imageIndex}: Order must be an integer between 0 and 10`
          );
        }
        orders.push(image.order);
      }

      // isMain validation
      if (image.isMain === true) {
        mainImageCount++;
      }

      // Duplicate URL check
      if (urls.includes(image.url)) {
        throw new Error(`Image ${imageIndex}: Duplicate image URL found`);
      }
      urls.push(image.url);

      // Duplicate publicId check
      if (publicIds.includes(image.publicId)) {
        throw new Error(`Image ${imageIndex}: Duplicate public ID found`);
      }
      publicIds.push(image.publicId);

      // Alt text format validation (if provided)
      if (image.altText && image.altText.trim() !== image.altText) {
        throw new Error(
          `Image ${imageIndex}: Alt text cannot have leading or trailing spaces`
        );
      }

      // Public ID format validation (basic)
      if (!/^[a-zA-Z0-9_\-\/]+$/.test(image.publicId)) {
        throw new Error(
          `Image ${imageIndex}: Public ID can only contain letters, numbers, underscores, hyphens, and forward slashes`
        );
      }
    }

    // Business logic validations
    if (mainImageCount > 1) {
      throw new Error("Only one image can be marked as main image");
    }

    // If no main image is specified, the first image should be main
    if (mainImageCount === 0 && images.length > 0) {
      // This is just a warning - we can auto-set the first image as main
      // throw new Error("At least one image must be marked as main image");
    }

    // Check for duplicate orders (if orders are specified)
    const nonZeroOrders = orders.filter((order) => order > 0);
    const uniqueOrders = [...new Set(nonZeroOrders)];
    if (nonZeroOrders.length !== uniqueOrders.length) {
      throw new Error(
        "Duplicate image orders are not allowed (except for order 0)"
      );
    }

    return true;
  }),

  body("listingType").custom((listingType, { req }) => {
    // Check if listing type is provided
    if (!listingType) {
      throw new Error("Listing type is required");
    }

    const status = req.body.status;

    // Cross-validation with status
    if (status === "sold" && listingType !== "sale") {
      throw new Error("Only 'sale' properties can have 'sold' status");
    } else if (status === "rented" && listingType !== "rent") {
      throw new Error("Only 'rent' properties can have 'rented' status");
    }

    return true;
  }),

  body("details.parking.type").custom((parkingType, { req }) => {
    const parkingAvailable = req.body.details?.parking?.available;

    // Convert string "true"/"false" to boolean for proper comparison
    const isParkingAvailable =
      parkingAvailable === true || parkingAvailable === "true";

    // If parking is available, type must be specified
    if (isParkingAvailable && (!parkingType || parkingType.trim() === "")) {
      throw new Error("Parking type is required when parking is available");
    } // If parking is not available, type should not be specified
    else if (!isParkingAvailable && parkingType && parkingType.trim() !== "") {
      throw new Error(
        "Parking type should not be specified when parking is not available"
      );
    }
    return true;
  }),

  body("details.parking.spaces").custom((spaces, { req }) => {
    const parkingAvailable = req.body.details?.parking?.available;

    // Convert string "true"/"false" to boolean for proper comparison
    const isParkingAvailable =
      parkingAvailable === true || parkingAvailable === "true";

    // If parking is available, spaces must be > 0
    if (isParkingAvailable) {
      // Check if spaces is provided and valid
      if (spaces === null || spaces === undefined || spaces === "") {
        throw new Error(
          "Number of parking spaces is required when parking is available"
        );
      }

      // Convert to number and validate
      const numSpaces = parseInt(spaces);
      if (isNaN(numSpaces) || numSpaces <= 0) {
        throw new Error(
          "Number of parking spaces must be greater than 0 when parking is available"
        );
      }
    } // If parking is not available, spaces should not be specified
    else if (!isParkingAvailable && spaces && spaces !== "0" && spaces !== 0) {
      throw new Error(
        "Parking spaces should not be specified when parking is not available"
      );
    }
    return true;
  }),

  // Comprehensive cross-field validation for property type changes
  body().custom(async (value, { req }) => {
    // This validation runs after all individual field validations
    // It handles the case where property type is changed and provides better error messages

    let { propertyType, amenities } = req.body;

    // If property type is not being updated, get it from the existing property
    if (!propertyType && req.params.id) {
      try {
        const Property = require("../models/Property");
        let existingProperty;

        // Handle both ObjectId and slug formats
        if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
          existingProperty = await Property.findById(req.params.id);
        } else {
          existingProperty = await Property.findOne({ slug: req.params.id });
        }

        if (existingProperty) {
          propertyType = existingProperty.propertyType;
        }
      } catch (error) {
        console.error(
          "Error fetching existing property for amenities validation:",
          error
        );
        // Continue without property type validation if we can't fetch the property
      }
    }

    // Validate amenities against property type if we have one
    if (
      propertyType &&
      amenities &&
      Array.isArray(amenities) &&
      amenities.length > 0
    ) {
      const validAmenitiesForType = PROPERTY_TYPE_AMENITIES_MAP[propertyType];

      // Get all valid amenities across all property types
      const allValidAmenities = new Set();
      Object.values(PROPERTY_TYPE_AMENITIES_MAP).forEach((amenitiesList) => {
        amenitiesList.forEach((amenity) => {
          allValidAmenities.add(amenity.toLowerCase());
        });
      });

      const customAmenities = [];

      for (const amenity of amenities) {
        // Check if amenity is in the valid list for all property types (case-insensitive)
        const isGloballyValid = allValidAmenities.has(amenity.toLowerCase());

        if (isGloballyValid) {
          if (validAmenitiesForType) {
            // If it's globally valid, check whether it's valid for the specific property type
            const isValidForPropertyType = validAmenitiesForType.some(
              (validAmenity) =>
                validAmenity.toLowerCase() === amenity.toLowerCase()
            );

            // If it's not valid for this specific property type, add it to customAmenities
            if (!isValidForPropertyType) {
              customAmenities.push(amenity);
            }
          } else {
            // If no valid amenities are defined for this property type, treat it as a custom amenity
            customAmenities.push(amenity);
          }
        } else {
          // If amenity is not globally valid (custom amenity), add to custom amenities list
          customAmenities.push(amenity);
        }
      }

      // Store warning for custom amenities (doesn't block the request)
      if (customAmenities.length > 0) {
        const warningMessage = `The following custom amenities are being used for property type ${propertyType}: ${customAmenities.join(
          ", "
        )}. These are not in the predefined list but will be accepted.`;

        // Store warning in request object for controller to access
        if (!req.validationWarnings) {
          req.validationWarnings = [];
        }
        req.validationWarnings.push({
          type: "custom_amenities",
          message: warningMessage,
          customAmenities: customAmenities,
        });
      }
    }

    return true;
  }),

  // Status validation for property updates
  body("status")
    .optional()
    .custom((status, { req }) => {
      // If status is provided, validate it's a valid status
      if (status && !PROPERTY_STATUS.includes(status)) {
        throw new Error(
          `Invalid status value: '${status}'. Valid statuses are: ${PROPERTY_STATUS.join(
            ", "
          )}`
        );
      }
      return true;
    }),

  cleanupParkingFields,
  handleValidationErrors,
];

/**
 * Validation for property query parameters
 */
const validatePropertyQuery = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be greater than 1"),

  query("limit")
    .optional()
    .isInt({ min: 10, max: 30 })
    .withMessage("Limit must be between 10 and 30"),

  query("status")
    .optional()
    .isIn(PROPERTY_STATUS)
    .withMessage("Invalid status"),

  query("emirate").optional().isIn(EMIRATES).withMessage("Invalid emirate"),

  query("area")
    .optional()
    .custom((area, { req }) => {
      // If area is provided, emirate should also be provided for validation
      if (area && !req.query.emirate) {
        throw new Error("Emirate must be specified when filtering by area");
      }

      // If both area and emirate are provided, validate that area belongs to emirate
      if (area && req.query.emirate) {
        const validAreas = EMIRATE_AREA_MAP[req.query.emirate];
        if (!validAreas || !validAreas.includes(area)) {
          throw new Error(
            `Invalid area "${area}" for emirate "${req.query.emirate}"`
          );
        }
      }

      return true;
    }),

  query("propertyType")
    .optional()
    .isIn(PROPERTY_TYPES)
    .withMessage("Invalid property type"),

  query("listingType")
    .optional()
    .isIn(LISTING_TYPES)
    .withMessage("Invalid listing type"),

  query("minPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Min price must be a positive number"),

  query("maxPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Max price must be a positive number")
    .custom((value, { req }) => {
      if (
        req.query.minPrice &&
        parseFloat(value) < parseFloat(req.query.minPrice)
      ) {
        throw new Error("Max price cannot be less than min price");
      }
      return true;
    }),

  query("bedrooms")
    .optional()
    .isInt({ min: 0, max: 20 })
    .withMessage("Bedrooms must be between 0 and 20"),

  query("sortBy")
    .optional()
    .isIn([
      "price",
      "createdAt",
      "updatedAt",
      "title",
      "featured",
      "details.area",
      "details.bedrooms",
    ])
    .withMessage(
      "Invalid sort field. Valid options: price, createdAt, updatedAt, title, featured, details.area, details.bedrooms"
    ),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be 'asc' or 'desc'"),

  handleValidationErrors,
];

/**
 * Validation for MongoDB ObjectId parameters
 */
const validateObjectId = [
  param("id").custom((value) => {
    // Allow both MongoDB ObjectId and slug formats
    if (value.match(/^[0-9a-fA-F]{24}$/)) {
      return true; // Valid ObjectId
    }
    if (value.match(/^[a-z0-9-]+$/)) {
      return true; // Valid slug format
    }
    throw new Error("Invalid property ID or slug format");
  }),

  handleValidationErrors,
];

/**
 * Lightweight multer middleware to parse form data without processing files
 * This allows us to access req.body.propertyData for validation before image processing
 */
const parseFormDataOnly = multer().any();

/**
 * Middleware to parse JSON data from FormData for property updates
 * This runs before validation to ensure req.body contains the parsed data
 */
const parsePropertyDataFromFormData = (req, res, next) => {
  // If propertyData exists in FormData, parse it and populate req.body
  if (req.body.propertyData) {
    try {
      const parsedData = JSON.parse(req.body.propertyData);

      // Merge the parsed data into req.body, overwriting the propertyData field
      Object.assign(req.body, parsedData);

      // Remove the original propertyData field since we've merged its contents
      delete req.body.propertyData;
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        error: "Invalid property data format",
      });
    }
  } else {
    console.log("â„¹ï¸ No propertyData field found, using req.body directly");
  }

  next();
};

/**
 * Enhanced middleware to parse both legacy and new FormData formats
 * Handles individual form fields and image metadata
 */
const parseEnhancedFormData = (req, res, next) => {
  // If propertyData exists in FormData, parse it and populate req.body (legacy format)
  if (req.body.propertyData) {
    try {
      const parsedData = JSON.parse(req.body.propertyData);
      Object.assign(req.body, parsedData);
      delete req.body.propertyData;
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        error: "Invalid property data format",
      });
    }
  } else {
    console.log("ℹ️ Parsing individual form fields");
    console.log("Raw req.body keys:", Object.keys(req.body));
    console.log("Raw req.files:", req.files ? req.files.length : 0);

    // Parse nested objects from form data (new format)
    const parsedBody = { ...req.body };

    // Parse location object
    if (req.body["location[address]"]) {
      parsedBody.location = {
        address: req.body["location[address]"],
        emirate: req.body["location[emirate]"],
        area: req.body["location[area]"],
        country: req.body["location[country]"],
        neighborhood: req.body["location[neighborhood]"] || "",
      };

      // Remove the individual location fields
      Object.keys(req.body).forEach((key) => {
        if (key.startsWith("location[")) {
          delete parsedBody[key];
        }
      });
    }

    // Parse details object
    const details = {};
    let hasDetails = false;

    Object.keys(req.body).forEach((key) => {
      if (key.startsWith("details[")) {
        hasDetails = true;
        const match = key.match(/details\[([^\]]+)\](?:\[([^\]]+)\])?/);
        if (match) {
          const [, field, subfield] = match;
          if (subfield) {
            // Nested field like details[parking][available]
            if (!details[field]) details[field] = {};
            details[field][subfield] = req.body[key];
          } else {
            // Direct field like details[bedrooms]
            details[field] = req.body[key];
          }
        }
        delete parsedBody[key];
      }
    });

    if (hasDetails) {
      parsedBody.details = details;
    }

    // Parse amenities array
    const amenities = [];
    Object.keys(req.body).forEach((key) => {
      if (key.startsWith("amenities[")) {
        const index = parseInt(key.match(/amenities\[(\d+)\]/)[1]);
        amenities[index] = req.body[key];
        delete parsedBody[key];
      }
    });

    if (amenities.length > 0) {
      parsedBody.amenities = amenities.filter(Boolean); // Remove empty slots
    }

    // Parse image metadata - handle both individual fields and JSON string
    let imageMetadata = [];

    // Check if imageMetadata is sent as a JSON string (new format)
    if (req.body.imageMetadata) {
      try {
        if (typeof req.body.imageMetadata === "string") {
          imageMetadata = JSON.parse(req.body.imageMetadata);
        } else if (Array.isArray(req.body.imageMetadata)) {
          imageMetadata = req.body.imageMetadata;
        }
        delete parsedBody.imageMetadata;
      } catch (error) {
        console.error("Failed to parse imageMetadata JSON:", error);
      }
    }

    // Also check for individual imageMetadata fields (legacy format)
    Object.keys(req.body).forEach((key) => {
      if (key.startsWith("imageMetadata[")) {
        const match = key.match(/imageMetadata\[(\d+)\]\[([^\]]+)\]/);
        if (match) {
          const [, index, field] = match;
          const idx = parseInt(index);
          if (!imageMetadata[idx]) imageMetadata[idx] = {};
          imageMetadata[idx][field] = req.body[key];
        }
        delete parsedBody[key];
      }
    });

    if (imageMetadata.length > 0) {
      req.imageMetadata = imageMetadata.filter(Boolean); // Store in req for later use
    }

    // Update req.body with parsed data
    req.body = parsedBody;
    console.log("Final parsed body:", JSON.stringify(req.body, null, 2));
    console.log("Image metadata:", req.imageMetadata);
  }

  next();
};

/**
 * Combined validation middleware for login
 *
 * Architecture:
 * 1. sanitizeInput - Cleans input while preserving password integrity
 * 2. validateRequestStructure - Validates request format
 * 3. ...validateLogin - Field-specific validation rules
 */
const loginValidation = [
  sanitizeInput,
  validateRequestStructure,
  ...validateLogin,
];

/**
 * Combined validation middleware for change password
 *
 * Architecture:
 * 1. sanitizeInput - Cleans input while preserving password integrity
 * 2. validateRequestStructure - Validates request format
 * 3. ...validateChangePassword - Field-specific validation rules
 */
const changePasswordValidation = [
  sanitizeInput,
  validateRequestStructure,
  ...validateChangePassword,
];

/**
 * Combined validation middleware for creating properties with pre-uploaded images
 * Uses modified security validation that allows image URLs
 */
const createPropertyWithImagesValidation = [
  sanitizeInput,
  ...validateCreateProperty,
];

/**
 * Combined validation middleware for updating properties
 */
const updatePropertyValidation = [
  sanitizeInput,
  ...validateObjectId,
  ...validateUpdateProperty,
];

/**
 * Combined validation middleware for property queries (GET requests - no sanitization needed)
 */
const propertyQueryValidation = [...validatePropertyQuery];

/**
 * Combined validation middleware for single property requests (GET requests - no sanitization needed)
 */
const singlePropertyValidation = [...validateObjectId];

/**
 * Custom validation function for username field
 */
const validateUsernameField = async (
  username,
  { req },
  isRequired = true,
  excludeUserId = null
) => {
  // Check if username is provided (required for create, optional for update)
  if (isRequired && (!username || username.trim() === "")) {
    throw new Error("Username is required");
  } // If not provided and not required, skip validation
  else if (!isRequired && (username === undefined || username === null)) {
    return true;
  } // If provided, validate it
  else if (username.trim() === "") {
    throw new Error("Username cannot be empty");
  }

  // Trim the username
  username = username.trim();

  // Check length
  if (username.length < 3) {
    throw new Error("Username must be at least 3 characters long");
  } else if (username.length > 50) {
    throw new Error("Username cannot exceed 50 characters");
  } // Check format - only allow letters, numbers, and underscores
  else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    throw new Error(
      "Username can only contain letters, numbers, and underscores"
    );
  }

  // Check for uniqueness only during updates (when excludeUserId is provided)
  // For creates, MongoDB unique constraints will handle duplicates
  if (excludeUserId) {
    const User = require("../models/User");
    const query = { username, _id: { $ne: excludeUserId } };
    const existingUser = await User.findOne(query);
    if (existingUser) {
      throw new Error("Username already exists");
    }
  }

  // Update the request body with the trimmed username
  req.body.username = username;

  return true;
};

/**
 * Custom validation function for email field
 */
const validateEmailField = async (
  email,
  { req },
  isRequired = true,
  excludeUserId = null
) => {
  // Check if email is provided (required for create, optional for update)
  if (isRequired && (!email || email.trim() === "")) {
    throw new Error("Email is required");
  } // If not provided and not required, skip validation
  else if (!isRequired && (email === undefined || email === null)) {
    return true;
  } // If provided, validate it
  else if (email.trim() === "") {
    throw new Error("Email cannot be empty");
  }

  // Trim the email
  email = email.trim().toLowerCase();

  // Check basic email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error("Must be a valid email address");
  } // Check length
  else if (email.length > 254) {
    throw new Error("Email address cannot exceed 254 characters");
  } // Check for common invalid patterns
  else if (
    email.includes("..") ||
    email.startsWith(".") ||
    email.endsWith(".")
  ) {
    throw new Error("Email address format is invalid");
  }

  // Check for uniqueness only during updates (when excludeUserId is provided)
  // For creates, MongoDB unique constraints will handle duplicates
  if (excludeUserId) {
    const User = require("../models/User");
    const query = { email, _id: { $ne: excludeUserId } };
    const existingUser = await User.findOne(query);
    if (existingUser) {
      throw new Error("Email already exists");
    }
  }

  // Update the request body with the normalized email
  req.body.email = email;

  return true;
};

/**
 * Custom validation function for password field
 */
const validatePasswordField = (password, { req }, isRequired = true) => {
  // Check if password is provided (required for create, optional for update)
  if (isRequired && (!password || password.trim() === "")) {
    throw new Error("Password is required");
  } // If not provided and not required, skip validation
  else if (!isRequired && (password === undefined || password === null)) {
    return true;
  } // If provided, validate it
  else if (password.trim() === "") {
    throw new Error("Password cannot be empty");
  } // Check minimum length
  else if (password.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  } // Check maximum length for security
  else if (password.length > 128) {
    throw new Error("Password cannot exceed 128 characters");
  } // Check for lowercase letter
  else if (!/(?=.*[a-z])/.test(password)) {
    throw new Error("Password must contain at least one lowercase letter");
  } // Check for uppercase letter
  else if (!/(?=.*[A-Z])/.test(password)) {
    throw new Error("Password must contain at least one uppercase letter");
  } // Check for number
  else if (!/(?=.*\d)/.test(password)) {
    throw new Error("Password must contain at least one number");
  } // Check for special character
  else if (!/(?=.*[@$!%*?&])/.test(password)) {
    throw new Error(
      "Password must contain at least one special character (@$!%*?&)"
    );
  }

  return true;
};

/**
 * Custom validation function for name field
 */
const validateNameField = (name, { req }, isRequired = true) => {
  // Check if name is provided (required for create, optional for update)
  if (isRequired && (!name || name.trim() === "")) {
    throw new Error("FullName is required");
  } // If not provided and not required, skip validation
  else if (!isRequired && (name === undefined || name === null)) {
    return true;
  } // If provided, validate it
  else if (name.trim() === "") {
    throw new Error("FullName cannot be empty");
  }

  // Trim the name
  name = name.trim();

  // Check length
  if (name.length < 5) {
    throw new Error("FullName must be at least 5 characters long");
  } else if (name.length > 100) {
    throw new Error("FullName cannot exceed 100 characters");
  }

  // Check format - allow letters, spaces, hyphens, apostrophes
  if (!/^[a-zA-Z\s'-]+$/.test(name)) {
    throw new Error(
      "FullName can only contain letters, spaces, hyphens, and apostrophes"
    );
  } // Check for meaningful content (not just spaces/special chars)
  else if (!/[a-zA-Z]/.test(name)) {
    throw new Error("FullName must contain at least some letters");
  } // Check for excessive spaces
  else if (name.includes("  ") || name.startsWith(" ") || name.endsWith(" ")) {
    throw new Error(
      "FullName cannot have leading, trailing, or multiple consecutive spaces"
    );
  }

  // Update the request body with the trimmed name
  req.body.name = name;

  return true;
};

/**
 * Custom validation function for role field
 */
const validateRoleField = (role, { req }, isRequired = false) => {
  // If role is not provided
  if (role === undefined || role === null || role === "") {
    if (isRequired) {
      // Set default role for create operations
      req.body.role = "admin";
    }
    return true;
  } // If provided, validate it
  else if (role.trim() === "") {
    throw new Error("Role cannot be empty");
  }

  // Trim the role
  role = role.trim();

  // Check if role is valid
  const validRoles = ["admin", "SuperAdmin"];
  if (!validRoles.includes(role)) {
    throw new Error("Role must be either admin or SuperAdmin");
  }

  // Update the request body with the trimmed role
  req.body.role = role;

  return true;
};

/**
 * Custom validation function for isActive field
 */
const validateIsActiveField = (isActive, { req }, isRequired = false) => {
  // isActive is optional for both create and update
  if (!isRequired && (isActive === undefined || isActive === null)) {
    return true;
  }

  // Check if isActive is a boolean
  if (typeof isActive !== "boolean") {
    // Try to convert string values
    if (isActive === "true" || isActive === true) {
      req.body.isActive = true;
      return true;
    } else if (isActive === "false" || isActive === false) {
      req.body.isActive = false;
      return true;
    } else {
      throw new Error("isActive must be true or false");
    }
  }

  return true;
};

/**
 * Validation rules for creating users (SuperAdmin only)
 */
const validateCreateUser = [
  body("username").custom(async (username, { req }) => {
    return await validateUsernameField(username, { req }, true);
  }),

  body("email").custom(async (email, { req }) => {
    return await validateEmailField(email, { req }, true);
  }),

  body("password").custom((password, { req }) => {
    return validatePasswordField(password, { req }, true);
  }),

  body("confirmPassword").custom((confirmPassword, { req }) => {
    // Check if confirm password is provided
    if (!confirmPassword || confirmPassword.trim() === "") {
      throw new Error("Please confirm your password");
    }

    // Check if passwords match
    if (confirmPassword !== req.body.password) {
      throw new Error("Passwords do not match");
    }

    return true;
  }),

  body("name").custom((name, { req }) => {
    return validateNameField(name, { req }, true);
  }),

  body("role").custom((role, { req }) => {
    return validateRoleField(role, { req }, false);
  }),

  handleValidationErrors,
];

/**
 * Validation rules for updating users (Profile updates only)
 * Only validates basic profile fields - role and status changes are handled separately
 */
const validateUpdateUser = [
  body("username").custom(async (username, { req }) => {
    return await validateUsernameField(username, { req }, false, req.params.id);
  }),

  body("email").custom(async (email, { req }) => {
    return await validateEmailField(email, { req }, false, req.params.id);
  }),

  body("name").custom((name, { req }) => {
    return validateNameField(name, { req }, false);
  }),

  handleValidationErrors,
];

/**
 * Validation rules for updating user status (SuperAdmin only)
 */
const validateUpdateUserStatus = [
  body("isActive").custom((isActive, { req }) => {
    // isActive is required for status updates
    if (isActive === undefined || isActive === null) {
      throw new Error("isActive field is required");
    }

    // Check if isActive is a boolean
    if (typeof isActive !== "boolean") {
      // Try to convert string values
      if (isActive === "true" || isActive === true) {
        req.body.isActive = true;
        return true;
      } else if (isActive === "false" || isActive === false) {
        req.body.isActive = false;
        return true;
      } else {
        throw new Error("isActive must be true or false");
      }
    }

    return true;
  }),

  handleValidationErrors,
];

/**
 * Validation rules for user queries (only validate parameters used in frontend)
 */
const validateUserQuery = [
  query("page").custom((page) => {
    if (page !== undefined) {
      const pageNum = parseInt(page);
      if (isNaN(pageNum) || pageNum < 1) {
        throw new Error("Page must be a positive integer");
      }
    }
    return true;
  }),

  query("limit").custom((limit) => {
    if (limit !== undefined) {
      const limitNum = parseInt(limit);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 10) {
        throw new Error("Limit must be between 1 and 10");
      }
    }
    return true;
  }),

  query("isActive").custom((isActive) => {
    if (isActive !== undefined) {
      if (isActive !== "true" && isActive !== "false") {
        throw new Error("isActive must be true or false");
      }
    }
    return true;
  }),

  query("search").custom((search, { req }) => {
    if (search !== undefined) {
      // Trim the search term
      search = search.trim();

      if (search.length < 1 || search.length > 100) {
        throw new Error("Search term must be between 1 and 100 characters");
      }

      // Update the request query with the trimmed search term
      req.query.search = search;
    }
    return true;
  }),

  handleValidationErrors,
];

/**
 * Combined validation middleware for creating users
 */
const createUserValidation = [sanitizeInput, ...validateCreateUser];

/**
 * Combined validation middleware for updating users
 */
const updateUserValidation = [
  sanitizeInput,
  ...validateObjectId,
  ...validateUpdateUser,
];

/**
 * Combined validation middleware for user queries (GET requests - no sanitization needed)
 */
const userQueryValidation = [...validateUserQuery];

/**
 * Combined validation middleware for single user requests (GET requests - no sanitization needed)
 */
const singleUserValidation = [...validateObjectId];

/**
 * Combined validation middleware for updating user status
 */
const updateUserStatusValidation = [
  sanitizeInput,
  ...validateObjectId,
  ...validateUpdateUserStatus,
];

/**
 * Validation rules for property ID parameter
 */
const validatePropertyId = [
  param("id").custom((id, { req }) => {
    // Check if ID is provided
    if (!id || id.trim() === "") {
      throw new Error("Property ID is required");
    }

    // Check if it's a valid MongoDB ObjectId
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      throw new Error("Invalid property ID format");
    }

    return true;
  }),
  handleValidationErrors,
];

/**
 * Validation rules for category ID parameter
 */
const validateCategoryId = [
  param("id").custom((id, { req }) => {
    // Check if ID is provided
    if (!id || id.trim() === "") {
      throw new Error("Category ID is required");
    }

    // Check if it's a valid MongoDB ObjectId
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      throw new Error("Invalid category ID format");
    }

    return true;
  }),
  handleValidationErrors,
];

/**
 * Validation rules for property rejection
 */
const validateRejection = [
  body("rejectionReason").custom((rejectionReason, { req }) => {
    // Check if rejection reason is provided
    if (!rejectionReason || rejectionReason.trim() === "") {
      throw new Error("Rejection reason is required");
    }

    // Trim the rejection reason
    rejectionReason = rejectionReason.trim();

    // Check minimum length
    if (rejectionReason.length < 10) {
      throw new Error("Rejection reason must be at least 10 characters long");
    }

    // Check maximum length
    if (rejectionReason.length > 500) {
      throw new Error("Rejection reason must not exceed 500 characters");
    }

    // Update the request body with the trimmed rejection reason
    req.body.rejectionReason = rejectionReason;

    return true;
  }),
  handleValidationErrors,
];

/**
 * Validation rules for blog creation
 */
const validateCreateBlog = [
  body("title").custom((title, { req }) => {
    if (!title || title.trim() === "") {
      throw new Error("Blog title is required");
    }

    title = title.trim();

    if (title.length < 5) {
      throw new Error("Blog title must be at least 5 characters long");
    }

    if (title.length > 200) {
      throw new Error("Blog title must not exceed 200 characters");
    }

    req.body.title = title;
    return true;
  }),

  body("content").custom((content, { req }) => {
    if (!content || content.trim() === "") {
      throw new Error("Blog content is required");
    }

    content = content.trim();

    if (content.length < 50) {
      throw new Error("Blog content must be at least 50 characters long");
    }

    req.body.content = content;
    return true;
  }),

  body("category").custom((category, { req }) => {
    if (!category || category.trim() === "") {
      throw new Error("Blog category is required");
    }

    // Check if it's a valid MongoDB ObjectId
    if (!/^[0-9a-fA-F]{24}$/.test(category)) {
      throw new Error("Invalid category ID format");
    }

    return true;
  }),

  body("tags")
    .optional()
    .custom((tags, { req }) => {
      if (tags) {
        let tagArray;

        if (typeof tags === "string") {
          try {
            tagArray = JSON.parse(tags);
          } catch (e) {
            // If not JSON, treat as comma-separated string
            tagArray = tags
              .split(",")
              .map((tag) => tag.trim())
              .filter((tag) => tag);
          }
        } else if (Array.isArray(tags)) {
          tagArray = tags;
        } else {
          throw new Error("Tags must be an array or comma-separated string");
        }

        if (tagArray.length > 10) {
          throw new Error("Maximum 10 tags allowed");
        }

        // Validate each tag
        for (const tag of tagArray) {
          if (typeof tag !== "string" || tag.trim().length === 0) {
            throw new Error("Each tag must be a non-empty string");
          }
          if (tag.trim().length > 50) {
            throw new Error("Each tag must not exceed 50 characters");
          }
        }

        req.body.tags = tagArray.map((tag) => tag.trim());
      }

      return true;
    }),

  body("status")
    .optional()
    .custom((status, { req }) => {
      const validStatuses = ["draft", "published", "archived"];
      if (status && !validStatuses.includes(status)) {
        throw new Error(`Status must be one of: ${validStatuses.join(", ")}`);
      }
      return true;
    }),

  body("featured")
    .optional()
    .isBoolean()
    .withMessage("Featured must be a boolean"),

  body("metaKeywords")
    .optional()
    .custom((metaKeywords, { req }) => {
      if (metaKeywords) {
        let keywordArray;

        if (typeof metaKeywords === "string") {
          try {
            keywordArray = JSON.parse(metaKeywords);
          } catch (e) {
            // If not JSON, treat as comma-separated string
            keywordArray = metaKeywords
              .split(",")
              .map((keyword) => keyword.trim())
              .filter((keyword) => keyword);
          }
        } else if (Array.isArray(metaKeywords)) {
          keywordArray = metaKeywords;
        } else {
          throw new Error(
            "Meta keywords must be an array or comma-separated string"
          );
        }

        if (keywordArray.length > 10) {
          throw new Error("Maximum 10 meta keywords allowed");
        }

        req.body.metaKeywords = keywordArray.map((keyword) => keyword.trim());
      }

      return true;
    }),

  handleValidationErrors,
];

/**
 * Validation rules for blog update
 */
const validateUpdateBlog = [
  body("title")
    .optional()
    .custom((title, { req }) => {
      if (title !== undefined) {
        if (!title || title.trim() === "") {
          throw new Error("Blog title cannot be empty");
        }

        title = title.trim();

        if (title.length < 5) {
          throw new Error("Blog title must be at least 5 characters long");
        }

        if (title.length > 200) {
          throw new Error("Blog title must not exceed 200 characters");
        }

        req.body.title = title;
      }
      return true;
    }),

  body("content")
    .optional()
    .custom((content, { req }) => {
      if (content !== undefined) {
        if (!content || content.trim() === "") {
          throw new Error("Blog content cannot be empty");
        }

        content = content.trim();

        if (content.length < 50) {
          throw new Error("Blog content must be at least 50 characters long");
        }

        req.body.content = content;
      }
      return true;
    }),

  body("category")
    .optional()
    .custom((category, { req }) => {
      if (category !== undefined) {
        if (!category || category.trim() === "") {
          throw new Error("Blog category cannot be empty");
        }

        // Check if it's a valid MongoDB ObjectId
        if (!/^[0-9a-fA-F]{24}$/.test(category)) {
          throw new Error("Invalid category ID format");
        }
      }

      return true;
    }),

  body("tags")
    .optional()
    .custom((tags, { req }) => {
      if (tags !== undefined) {
        let tagArray;

        if (typeof tags === "string") {
          try {
            tagArray = JSON.parse(tags);
          } catch (e) {
            // If not JSON, treat as comma-separated string
            tagArray = tags
              .split(",")
              .map((tag) => tag.trim())
              .filter((tag) => tag);
          }
        } else if (Array.isArray(tags)) {
          tagArray = tags;
        } else {
          throw new Error("Tags must be an array or comma-separated string");
        }

        if (tagArray.length > 10) {
          throw new Error("Maximum 10 tags allowed");
        }

        // Validate each tag
        for (const tag of tagArray) {
          if (typeof tag !== "string" || tag.trim().length === 0) {
            throw new Error("Each tag must be a non-empty string");
          }
          if (tag.trim().length > 50) {
            throw new Error("Each tag must not exceed 50 characters");
          }
        }

        req.body.tags = tagArray.map((tag) => tag.trim());
      }

      return true;
    }),

  body("status")
    .optional()
    .custom((status, { req }) => {
      const validStatuses = ["draft", "published", "archived"];
      if (status && !validStatuses.includes(status)) {
        throw new Error(`Status must be one of: ${validStatuses.join(", ")}`);
      }
      return true;
    }),

  body("featured")
    .optional()
    .isBoolean()
    .withMessage("Featured must be a boolean"),

  body("metaKeywords")
    .optional()
    .custom((metaKeywords, { req }) => {
      if (metaKeywords !== undefined) {
        let keywordArray;

        if (typeof metaKeywords === "string") {
          try {
            keywordArray = JSON.parse(metaKeywords);
          } catch (e) {
            // If not JSON, treat as comma-separated string
            keywordArray = metaKeywords
              .split(",")
              .map((keyword) => keyword.trim())
              .filter((keyword) => keyword);
          }
        } else if (Array.isArray(metaKeywords)) {
          keywordArray = metaKeywords;
        } else {
          throw new Error(
            "Meta keywords must be an array or comma-separated string"
          );
        }

        if (keywordArray.length > 10) {
          throw new Error("Maximum 10 meta keywords allowed");
        }

        req.body.metaKeywords = keywordArray.map((keyword) => keyword.trim());
      }

      return true;
    }),

  handleValidationErrors,
];

/**
 * Validation rules for blog query parameters
 */
const validateBlogQuery = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),
  query("category")
    .optional()
    .isMongoId()
    .withMessage("Category must be a valid MongoDB ObjectId"),
  query("status")
    .optional()
    .isIn(["draft", "published", "archived"])
    .withMessage("Invalid status"),
  query("featured")
    .optional()
    .isBoolean()
    .withMessage("Featured must be a boolean"),
  query("search")
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search term must be between 1 and 100 characters"),
  query("tags")
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage("Tags parameter must be between 1 and 200 characters"),
  query("sortBy")
    .optional()
    .isIn(["createdAt", "publishedAt", "title"])
    .withMessage("Invalid sort field"),
  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be 'asc' or 'desc'"),
  handleValidationErrors,
];

/**
 * Validation rules for blog category query parameters
 */
const validateBlogCategoryQuery = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),
  query("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
  query("search")
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search term must be between 1 and 100 characters"),
  query("sortBy")
    .optional()
    .isIn(["createdAt", "name", "updatedAt"])
    .withMessage("Invalid sort field"),
  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be 'asc' or 'desc'"),
  handleValidationErrors,
];

/**
 * Combined validation for blog creation with images
 */
const createBlogValidation = [...validateCreateBlog];

/**
 * Combined validation for blog update
 */
const updateBlogValidation = [...validateUpdateBlog];

/**
 * Combined validation for blog query
 */
const blogQueryValidation = [...validateBlogQuery];

/**
 * Combined validation for single blog
 */
const singleBlogValidation = [...validateObjectId];

/**
 * Combined validation for blog category query
 */
const blogCategoryQueryValidation = [...validateBlogCategoryQuery];

/**
 * Combined validation for single blog category
 */
const singleBlogCategoryValidation = [...validateObjectId];

/**
 * Validation rules for creating blog categories
 */
const validateCreateBlogCategory = [
  body("name").custom(async (name, { req }) => {
    // Check if name is required (empty string check)
    if (name === "" || !name) {
      throw new Error("Category name is required");
    }

    // Trim the name
    name = name.trim();

    // Length validation
    if (name.length < 2) {
      throw new Error("Category name must be at least 2 characters long");
    } else if (name.length > 100) {
      throw new Error("Category name cannot exceed 100 characters");
    }

    // Check for meaningful content (not just spaces/special chars)
    if (!/[a-zA-Z]/.test(name)) {
      throw new Error("Category name must contain at least some letters");
    }

    // Check for duplicate names
    const BlogCategory = require("../models/BlogCategory");
    const existing = await BlogCategory.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });
    if (existing) {
      throw new Error(
        "A category with this name already exists. Please use a unique name."
      );
    }

    // Update the request body with the trimmed name
    req.body.name = name;
    return true;
  }),

  body("description").custom((description, { req }) => {
    // Description is optional, but if provided, validate it
    if (description !== undefined && description !== null) {
      // Trim the description
      description = description.trim();

      // Length validation
      if (description.length > 500) {
        throw new Error("Description cannot exceed 500 characters");
      }

      // Update the request body with the trimmed description
      req.body.description = description;
    }

    return true;
  }),

  handleValidationErrors,
];

/**
 * Validation rules for updating blog categories
 */
const validateUpdateBlogCategory = [
  body("name").custom(async (name, { req }) => {
    // Name is optional for updates, but if provided, validate it
    if (name !== undefined && name !== null) {
      // Check if name is empty string
      if (name === "") {
        throw new Error("Category name cannot be empty");
      }

      // Trim the name
      name = name.trim();

      // Length validation
      if (name.length < 2) {
        throw new Error("Category name must be at least 2 characters long");
      } else if (name.length > 100) {
        throw new Error("Category name cannot exceed 100 characters");
      }

      // Check for meaningful content (not just spaces/special chars)
      if (!/[a-zA-Z]/.test(name)) {
        throw new Error("Category name must contain at least some letters");
      }

      // Check for duplicate names (excluding current category)
      const BlogCategory = require("../models/BlogCategory");
      const categoryId = req.params.id;

      const existing = await BlogCategory.findOne({
        name: { $regex: new RegExp(`^${name}$`, "i") },
        _id: { $ne: categoryId },
      });
      if (existing) {
        throw new Error(
          "A category with this name already exists. Please use a unique name."
        );
      }

      // Update the request body with the trimmed name
      req.body.name = name;
    }

    return true;
  }),

  body("description").custom((description, { req }) => {
    // Description is optional, but if provided, validate it
    if (description !== undefined && description !== null) {
      // Trim the description
      description = description.trim();

      // Length validation
      if (description.length > 500) {
        throw new Error("Description cannot exceed 500 characters");
      }

      // Update the request body with the trimmed description
      req.body.description = description;
    }

    return true;
  }),

  body("isActive").custom((isActive, { req }) => {
    // isActive is optional, but if provided, validate it
    if (isActive !== undefined && isActive !== null) {
      // Check if it's a boolean
      if (typeof isActive !== "boolean") {
        throw new Error("isActive must be a boolean value");
      }
    }

    return true;
  }),

  handleValidationErrors,
];

/**
 * Combined validation middleware for creating blog categories
 */
const createBlogCategoryValidation = [
  sanitizeInput,
  ...validateCreateBlogCategory,
];

/**
 * Combined validation middleware for updating blog categories
 */
const updateBlogCategoryValidation = [
  sanitizeInput,
  ...validateObjectId,
  ...validateUpdateBlogCategory,
];

module.exports = {
  handleValidationErrors,
  loginValidation,
  changePasswordValidation,
  createPropertyWithImagesValidation,
  updatePropertyValidation,
  propertyQueryValidation,
  singlePropertyValidation,
  createUserValidation,
  updateUserValidation,
  updateUserStatusValidation,
  userQueryValidation,
  singleUserValidation,
  parseFormDataOnly,
  parsePropertyDataFromFormData,
  parseEnhancedFormData,
  // Property approval validations
  validatePropertyId,
  validateRejection,
  // Category approval validations
  validateCategoryId,
  // Blog validations
  createBlogValidation,
  updateBlogValidation,
  blogQueryValidation,
  singleBlogValidation,
  // Blog category validations
  createBlogCategoryValidation,
  updateBlogCategoryValidation,
  blogCategoryQueryValidation,
  singleBlogCategoryValidation,
};
