const mongoose = require("mongoose");

// Image schema for blog images (same as Property model)
const imageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String, // For local file identification
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
    size: Number, // Compressed file size after processing
    originalSize: Number, // Original file size before compression
    format: String,
  },
  {
    _id: true,
  }
);

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Blog title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    content: {
      type: String,
      required: [true, "Blog content is required"],
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Author is required"],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BlogCategory",
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    featured: {
      type: Boolean,
      default: false,
    },
    featuredImage: {
      type: String,
    },
    images: {
      type: [imageSchema],
      default: [],
    },

    publishedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Create slug from title before saving
blogSchema.pre("save", function (next) {
  if (this.isModified("title") || this.isNew) {
    this.slug = (this.title || "")
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "-")
      .trim();
  }

  // Set publishedAt when status changes to published
  if (
    this.isModified("status") &&
    this.status === "published" &&
    !this.publishedAt
  ) {
    this.publishedAt = new Date();
  }

  next();
});

// Ensure slug uniqueness
blogSchema.pre("save", async function (next) {
  if (this.isModified("slug") || this.isNew) {
    let baseSlug = this.slug;
    let counter = 1;
    let uniqueSlug = baseSlug;

    while (true) {
      const existingBlog = await this.constructor.findOne({
        slug: uniqueSlug,
        _id: { $ne: this._id },
      });

      if (!existingBlog) {
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
blogSchema.index({ slug: 1 });
blogSchema.index({ status: 1 });
blogSchema.index({ category: 1 });
blogSchema.index({ author: 1 });
blogSchema.index({ tags: 1 });
blogSchema.index({ featured: 1 });
blogSchema.index({ publishedAt: -1 });
blogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Blog", blogSchema);
