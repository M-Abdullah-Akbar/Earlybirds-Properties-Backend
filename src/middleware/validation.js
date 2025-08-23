const { body, query, param, validationResult } = require("express-validator");
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

  if (!errors.isEmpty()) {
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
 * Validation rules for login endpoint
 */
const validateLogin = [
  body("username")
    .notEmpty()
    .withMessage("Username is required")
    .isLength({ min: 3, max: 50 })
    .withMessage("Username must be between 3 and 50 characters")
    .trim()
    .escape()
    .matches(/^[a-zA-Z0-9_.-]+$/)
    .withMessage(
      "Username can only contain letters, numbers, dots, hyphens, and underscores"
    ),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6, max: 128 })
    .withMessage("Password must be between 6 and 128 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one lowercase letter, one uppercase letter, and one number"
    ),

  handleValidationErrors,
];

/**
 * Validation rules for change password endpoint
 */
const validateChangePassword = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required")
    .isLength({ min: 1, max: 128 })
    .withMessage("Current password cannot be empty"),

  body("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .isLength({ min: 6, max: 128 })
    .withMessage("New password must be between 6 and 128 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "New password must contain at least one lowercase letter, one uppercase letter, and one number"
    )
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error("New password must be different from current password");
      }
      return true;
    }),

  body("confirmPassword")
    .notEmpty()
    .withMessage("Confirm password is required")
    .custom((value, { req }) => {
      if (value && value !== req.body.newPassword) {
        throw new Error("Password confirmation does not match new password");
      }
      return true;
    }),

  handleValidationErrors,
];

/**
 * Sanitize request body to prevent XSS and injection attacks
 * Note: Password fields are excluded from aggressive sanitization
 */
const sanitizeInput = (req, res, next) => {
  if (req.body) {
    console.log("ðŸ” sanitizeInput middleware called");
    console.log("ðŸ” req.body before sanitization:", req.body);

    // Fields that should not be aggressively sanitized (passwords, etc.)
    const excludeFields = [
      "password",
      "currentPassword",
      "newPassword",
      "confirmPassword",
    ];

    Object.keys(req.body).forEach((key) => {
      if (typeof req.body[key] === "string" && !excludeFields.includes(key)) {
        console.log(`ðŸ” Sanitizing field: ${key}, value: "${req.body[key]}"`);

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

        console.log(`âœ… After sanitization: ${key} = "${req.body[key]}"`);
      } else if (typeof req.body[key] === "string") {
        // For password fields, only trim whitespace
        console.log(`ðŸ” Trimming password field: ${key}`);
        req.body[key] = req.body[key].trim();
      }
    });

    console.log("âœ… req.body after sanitization:", req.body);
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
  }

  // Check for unexpected fields in change password
  if (req.path === "/change-password") {
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
  if (req.body.details && req.body.details.parking) {
    const parking = req.body.details.parking;

    // If parking.available is null, undefined, or false, remove parking fields that are null
    if (!parking.available) {
      if (
        parking.type === null ||
        parking.type === undefined ||
        parking.type === ""
      ) {
        delete req.body.details.parking.type;
      }
      if (parking.spaces === null || parking.spaces === undefined) {
        delete req.body.details.parking.spaces;
      }
    }
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
      if (title.length < 5 || title.length > 200) {
        throw new Error("Title must be between 5 and 200 characters");
      }

      // Check for meaningful content (not just spaces/special chars)
      if (!/[a-zA-Z]/.test(title)) {
        throw new Error("Title must contain at least some letters");
      }

      // Update the request body with the trimmed title
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
    if (description.length < 200 || description.length > 10000) {
      throw new Error("Description must be between 200 and 10000 characters");
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
    }

    // Must be string
    if (typeof propertyType !== "string") {
      throw new Error("Property type must be a string");
    }

    // Format validation
    if (
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

  body("location.address").notEmpty().withMessage("Address is required").trim(),

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
      if (bedrooms !== null && bedrooms !== undefined) {
        throw new Error(
          `Bedrooms field is not applicable for ${propertyType} property type. Please remove this field.`
        );
      }
      // If bedrooms is null or undefined (field not sent or explicitly null), that's perfectly fine
      return true;
    }

    // For all other property types, bedrooms are required
    if (bedrooms === null) {
      throw new Error("Number of bedrooms is required");
    }

    if (!Number.isInteger(Number(bedrooms)) || Number(bedrooms) < 0) {
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
      if (floorLevel !== undefined) {
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
      if (landArea !== null && landArea !== undefined) {
        throw new Error(
          `Land area field is not applicable for ${propertyType} property type. Please remove this field.`
        );
      }
      // If landArea is null or undefined (field not sent or explicitly null), that's perfectly fine
      return true;
    }

    // For villa, townhouse, and office property types, landArea is optional
    if (landArea === null || landArea === undefined) {
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
  body("images").custom((images) => {
    // Check if images are provided
    if (images.length === 0) {
      throw new Error("At least one image is required");
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

  body("details.parking.type")
    .optional()
    .custom((parkingType, { req }) => {
      const parkingAvailable = req.body.details?.parking?.available;
      // If parking is available, type must be specified
      if (parkingAvailable === true && !parkingType) {
        throw new Error("Parking type is required when parking is available");
      } // If parking is not available, type should not be specified
      else if (parkingAvailable === false && parkingType) {
        throw new Error(
          "Parking type should not be specified when parking is not available"
        );
      }

      return true;
    }),

  body("details.parking.spaces").custom((spaces, { req }) => {
    const parkingAvailable = req.body.details?.parking?.available;

    // If parking is available, spaces must be > 0
    if (parkingAvailable === true && spaces <= 0) {
      throw new Error(
        "Number of parking spaces must be greater than 0 when parking is available"
      );
    } // If parking is not available, space should not be specified
    else if (parkingAvailable === false && spaces) {
      throw new Error(
        "Parking spaces should not be specified when parking is not available"
      );
    }

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
      if (title.length < 5 || title.length > 200) {
        throw new Error("Title must be between 5 and 200 characters");
      }

      // Check for meaningful content (not just spaces/special chars)
      if (!/[a-zA-Z]/.test(title)) {
        throw new Error("Title must contain at least some letters");
      }

      // Update the request body with the trimmed title
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
    if (description.length < 200 || description.length > 10000) {
      throw new Error("Description must be between 200 and 10000 characters");
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
    }

    // Must be string
    if (typeof propertyType !== "string") {
      throw new Error("Property type must be a string");
    }

    // Format validation
    if (
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

  body("location.address").notEmpty().withMessage("Address is required").trim(),

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
            `Cannot change emirate to "${emirate}" because the current area "${area}" is not valid for this emirate. Valid areas for ${emirate} are: ${validAreasForEmirate.join(
              ", "
            )}. Please also update the area field.`
          );
        }
      }

      return true;
    }),

  body("location.area")
    .optional()
    .custom(async (area, { req }) => {
      // Skip validation if area is not being updated
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
        throw new Error(
          `Area "${area}" is not valid for emirate "${emirate}". Valid areas for ${emirate} are: ${validAreasForEmirate.join(
            ", "
          )}`
        );
      }

      return true;
    }),

  // Property details validation

  body("details.bedrooms").custom((bedrooms, { req }) => {
    const propertyType = req.body.propertyType;

    // For studio and office property types, bedrooms should not be provided
    if (propertyType === "studio" || propertyType === "office") {
      // If bedrooms field exists (not null and not undefined), reject it
      if (bedrooms !== "") {
        throw new Error(
          `Bedrooms field is not applicable for ${propertyType} property type. Please remove this field.`
        );
      }
      // If bedrooms is null or undefined (field not sent or explicitly null), that's perfectly fine
      return true;
    }

    // For all other property types, bedrooms are required
    if (bedrooms === null) {
      throw new Error("Number of bedrooms is required");
    }

    if (!Number.isInteger(Number(bedrooms)) || Number(bedrooms) < 0) {
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
    if (totalFloors === "") {
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
      if (floorLevel !== "") {
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
      if (landArea !== "") {
        throw new Error(
          `Land area field is not applicable for ${propertyType} property type. Please remove this field.`
        );
      }
      // If landArea is null or undefined (field not sent or explicitly null), that's perfectly fine
      return true;
    }

    // For villa, townhouse, and office property types, landArea is optional
    if (landArea === "") {
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
    // For updates, if images field is not provided at all, skip validation (keep existing images)
    if (images === undefined) {
      return true;
    }

    // If images field is provided but empty, it means user wants to remove all images
    // This should be rejected as properties must have at least one image
    if (images.length === 0) {
      throw new Error("At least one image is required");
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

  body("details.parking.type")
    .optional()
    .custom((parkingType, { req }) => {
      const parkingAvailable = req.body.details?.parking?.available;
      // If parking is available, type must be specified
      if (parkingAvailable === true && !parkingType) {
        throw new Error("Parking type is required when parking is available");
      } // If parking is not available, type should not be specified
      else if (parkingAvailable === false && parkingType) {
        throw new Error(
          "Parking type should not be specified when parking is not available"
        );
      }

      return true;
    }),

  body("details.parking.spaces").custom((spaces, { req }) => {
    const parkingAvailable = req.body.details?.parking?.available;

    // If parking is available, spaces must be > 0
    if (parkingAvailable === true && spaces <= 0) {
      throw new Error(
        "Number of parking spaces must be greater than 0 when parking is available"
      );
    } // If parking is not available, space should not be specified
    else if (parkingAvailable === false && spaces) {
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
 * Combined validation middleware for property queries
 */
const propertyQueryValidation = [sanitizeInput, ...validatePropertyQuery];

/**
 * Combined validation middleware for single property requests
 */
const singlePropertyValidation = [sanitizeInput, ...validateObjectId];

/**
 * Validation rules for creating users (SuperAdmin only)
 */
const validateCreateUser = [
  body("username")
    .notEmpty()
    .withMessage("Username is required")
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores")
    .trim()
    .custom(async (username) => {
      const User = require("../models/User");
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        throw new Error("Username already exists");
      }
      return true;
    }),

  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Must be a valid email address")
    .normalizeEmail()
    .custom(async (email) => {
      const User = require("../models/User");
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new Error("Email already exists");
      }
      return true;
    }),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must be between 8 and 128 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character"
    ),

  body("name")
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters")
    .trim()
    .escape(),

  body("role").optional().isIn(["admin"]).withMessage("Role must be admin"),

  handleValidationErrors,
];

/**
 * Validation rules for updating users (SuperAdmin only)
 */
const validateUpdateUser = [
  body("username")
    .optional()
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores")
    .trim()
    .custom(async (username, { req }) => {
      if (!username) return true;
      const User = require("../models/User");
      const existingUser = await User.findOne({
        username,
        _id: { $ne: req.params.id },
      });
      if (existingUser) {
        throw new Error("Username already exists");
      }
      return true;
    }),

  body("email")
    .optional()
    .isEmail()
    .withMessage("Must be a valid email address")
    .normalizeEmail()
    .custom(async (email, { req }) => {
      if (!email) return true;
      const User = require("../models/User");
      const existingUser = await User.findOne({
        email,
        _id: { $ne: req.params.id },
      });
      if (existingUser) {
        throw new Error("Email already exists");
      }
      return true;
    }),

  body("password")
    .optional()
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must be between 8 and 128 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character"
    ),

  body("name")
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters")
    .trim()
    .escape(),

  body("role").optional().isIn(["admin"]).withMessage("Role must be admin"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be true or false"),

  handleValidationErrors,
];

/**
 * Validation rules for user queries
 */
const validateUserQuery = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("role")
    .optional()
    .isIn(["SuperAdmin", "admin"])
    .withMessage("Role must be SuperAdmin or admin"),

  query("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be true or false"),

  query("search")
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search term must be between 1 and 100 characters")
    .trim(),

  query("sortBy")
    .optional()
    .isIn(["createdAt", "updatedAt", "name", "email", "username", "role"])
    .withMessage(
      "sortBy must be one of: createdAt, updatedAt, name, email, username, role"
    ),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("sortOrder must be asc or desc"),

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
 * Combined validation middleware for user queries
 */
const userQueryValidation = [sanitizeInput, ...validateUserQuery];

/**
 * Combined validation middleware for single user requests
 */
const singleUserValidation = [sanitizeInput, ...validateObjectId];

/**
 * Validation rules for creating properties without images
 */
const createPropertyWithoutImagesValidation = [
  // Basic property information
  validateCreateProperty,

  // Process validation results
  handleValidationErrors,
];

module.exports = {
  loginValidation,
  changePasswordValidation,
  createPropertyWithImagesValidation,
  createPropertyWithoutImagesValidation,
  updatePropertyValidation,
  propertyQueryValidation,
  singlePropertyValidation,
  createUserValidation,
  updateUserValidation,
  userQueryValidation,
  singleUserValidation,
  parsePropertyDataFromFormData,
};
