const mongoose = require("mongoose");
const {
  EMIRATES,
  LISTING_TYPES,
  PROPERTY_STATUS,
  APPROVAL_STATUS,
  AREA_UNITS,
  PARKING_TYPES,
  PRICE_TYPES,
  COUNTRIES,
  CURRENCIES,
} = require("../constants/propertyTypes");
const slugify = require("slugify");

const imageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String, // For Cloudinary
      required: true,
    },
    altText: {
      type: String,
      default: "",
    },
    order: {
      type: Number,
      default: 0,
    },
    isMain: {
      type: Boolean,
      default: false,
    },
    // Original file info
    originalName: String,
    size: Number,
    format: String,
  },
  {
    _id: true,
  }
);

const locationSchema = new mongoose.Schema(
  {
    address: {
      type: String,
      required: false, // Made optional
    },
    emirate: {
      type: String,
      required: false, // Made optional
      enum: [...EMIRATES, ""], // Allow empty string
    },
    area: {
      type: String,
      required: false, // Made optional
      enum: [], // This will be populated dynamically based on the selected emirate
    },
    country: {
      type: String,
      default: COUNTRIES[0],
      enum: COUNTRIES,
    },
    neighborhood: {
      type: String,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

const detailsSchema = new mongoose.Schema(
  {
    bedrooms: {
      type: Number,
    },
    bathrooms: {
      type: Number,
      required: false, // Made optional
    },
    area: {
      type: Number,
      required: false, // Made optional
    },
    areaUnit: {
      type: String,
      enum: AREA_UNITS,
      default: AREA_UNITS[0],
    },
    floorLevel: {
      type: String,
      trim: true,
    },
    totalFloors: {
      type: Number,
    },
    landArea: {
      type: Number,
    },
    yearBuilt: {
      type: Number,
    },
    parking: {
      available: {
        type: Boolean,
        default: false,
      },
      type: {
        type: String,
        enum: PARKING_TYPES,
      },
      spaces: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    _id: false,
  }
);

const propertySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: false, // Made optional
      default: undefined, // Explicitly no default
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      required: false, // Auto-generated in pre-save hook
    },
    description: {
      type: String,
      required: false, // Made optional
    },
    propertyType: {
      type: String,
      required: false, // Made optional
      default: undefined, // Explicitly no default
    },
    price: {
      type: Number,
      required: false, // Made optional (was conditional, now always optional)
    },
    currency: {
      type: String,
      default: CURRENCIES[0],
      enum: CURRENCIES,
    },
    priceType: {
      type: String,
      enum: PRICE_TYPES,
      default: PRICE_TYPES[0],
    },
    location: {
      type: locationSchema,
      required: false, // Made optional
    },
    details: {
      type: detailsSchema,
      required: false, // Made optional
    },
    amenities: {
      type: [String],
      default: [],
    },
    images: {
      type: [imageSchema],
      required: false, // Made optional
    },
    featured: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: PROPERTY_STATUS,
      default: PROPERTY_STATUS[0],
    },
    previousStatus: {
      type: String,
      enum: PROPERTY_STATUS,
      required: false,
    },
    listingType: {
      type: String,
      enum: [...LISTING_TYPES, ""], // Allow empty string
      required: false, // Made optional
      default: undefined, // Explicitly no default
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // Keep this required for audit purposes
    },
    // Manual timestamp management (similar to approval system)
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedAt: {
      type: Date,
    },
    // Approval system fields
    approvalStatus: {
      type: String,
      enum: APPROVAL_STATUS,
      default: "not_applicable", // Default for drafts, controller will set appropriately
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // SuperAdmin who approved/rejected
    },
    approvedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: false, // Disable automatic timestamps, we'll manage them manually
  }
);

// Indexes for better query performance
propertySchema.index({ slug: 1 });
propertySchema.index({ status: 1, listingType: 1 });
propertySchema.index({ propertyType: 1 });
propertySchema.index({ price: 1 });
propertySchema.index({ "location.emirate": 1 });
propertySchema.index({ "location.area": 1 });
propertySchema.index({ "details.bedrooms": 1 });
propertySchema.index({ "details.area": 1 });
propertySchema.index({ featured: 1 });
propertySchema.index({ createdAt: -1 });
propertySchema.index({ approvalStatus: 1 });
propertySchema.index({ createdBy: 1, approvalStatus: 1 });

// Text search index
propertySchema.index({
  title: "text",
  description: "text",
  "location.address": "text",
  "location.emirate": "text",
  "location.area": "text",
  "location.neighborhood": "text",
});

// Generate slug before saving
propertySchema.pre("save", function (next) {
  if (this.isModified("title") || this.isNew || !this.slug) {
    // If title exists, use it for slug generation
    if (this.title && this.title.trim()) {
      this.slug = slugify(this.title, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    } else {
      // If no title, generate a slug using the property ID or timestamp
      const timestamp = Date.now();
      this.slug = `property-${timestamp}`;
    }
  }

  // Ensure slug is always present
  if (!this.slug) {
    const timestamp = Date.now();
    this.slug = `property-${timestamp}`;
  }

  next();
});

// Ensure only one main image
propertySchema.pre("save", function (next) {
  if (this.images && this.images.length > 0) {
    const mainImages = this.images.filter((img) => img.isMain);

    // If no main image is set, make the first one main
    if (mainImages.length === 0) {
      this.images[0].isMain = true;
    }
    // If multiple main images, keep only the first one
    else if (mainImages.length > 1) {
      this.images.forEach((img, index) => {
        img.isMain = index === 0;
      });
    }
  }
  next();
});

// Manage timestamps manually - prevent updatedAt during creation
propertySchema.pre("save", function (next) {
  // If this is a new document (creation), don't set updatedAt or updatedBy
  if (this.isNew) {
    this.updatedAt = undefined;
    this.updatedBy = undefined;
  }
  // If this is an update and updatedAt is not already set, set it now
  else if (!this.updatedAt) {
    this.updatedAt = new Date();
  }

  next();
});

module.exports = mongoose.model("Property", propertySchema);
