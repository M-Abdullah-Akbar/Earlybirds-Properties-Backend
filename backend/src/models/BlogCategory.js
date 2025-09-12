const mongoose = require("mongoose");

const blogCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      unique: true,
      maxlength: [100, "Category name cannot exceed 100 characters"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    rejectionReason: {
      type: String,
      maxlength: [500, "Rejection reason cannot exceed 500 characters"],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedAt: {
      type: Date,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

// Set updatedAt only when document is modified (not on creation)
blogCategorySchema.pre("save", function (next) {
  if (!this.isNew && this.isModified()) {
    this.updatedAt = new Date();
  }
  next();
});

// Create slug from name before saving
blogCategorySchema.pre("save", function (next) {
  if (this.isModified("name") || this.isNew) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "-")
      .trim();
  }

  next();
});

// Ensure slug uniqueness
blogCategorySchema.pre("save", async function (next) {
  if (this.isModified("slug") || this.isNew) {
    let baseSlug = this.slug;
    let counter = 1;
    let uniqueSlug = baseSlug;

    while (true) {
      const existingCategory = await this.constructor.findOne({
        slug: uniqueSlug,
        _id: { $ne: this._id },
      });

      if (!existingCategory) {
        this.slug = uniqueSlug;
        break;
      }

      uniqueSlug = `${baseSlug}-${counter}`;
      counter++;
    }
  }
  next();
});

// Indexes for better performance
blogCategorySchema.index({ slug: 1 });
blogCategorySchema.index({ name: 1 });
blogCategorySchema.index({ isActive: 1 });
blogCategorySchema.index({ sortOrder: 1 });
blogCategorySchema.index({ approvalStatus: 1 });

// Indexes for regex search performance
blogCategorySchema.index({ name: 1 });
blogCategorySchema.index({ createdBy: 1 });

module.exports = mongoose.model("BlogCategory", blogCategorySchema);
