const mongoose = require("mongoose");
const {
  EMIRATES,
  LISTING_TYPES,
  PROPERTY_STATUS,
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
      required: true,
    },
    emirate: {
      type: String,
      required: true,
      enum: EMIRATES,
    },
    area: {
      type: String,
      required: true,
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
      required: true,
    },
    area: {
      type: Number,
      required: true,
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
      required: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      required: false, // Auto-generated in pre-save hook
    },
    description: {
      type: String,
      required: true,
    },
    propertyType: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
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
      required: true,
    },
    details: {
      type: detailsSchema,
      required: true,
    },
    amenities: {
      type: [String],
      default: [],
    },
    images: {
      type: [imageSchema],
      required: true,
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
    listingType: {
      type: String,
      enum: LISTING_TYPES,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
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
    this.slug = slugify(this.title, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g,
    });
  }

  // Ensure slug is always present
  if (!this.slug) {
    return next(new Error("Failed to generate slug"));
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

module.exports = mongoose.model("Property", propertySchema);
