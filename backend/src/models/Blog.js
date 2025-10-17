const mongoose = require("mongoose");

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
    focusKeyword: {
      type: String,
      required: [true, "Focus keyword is required"],
      trim: true,
      lowercase: true
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
    images: [
      {
        url: String,
        alt: String,
        caption: String,
      },
    ],

    // META Information fields
    metaTitle: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    metaDescription: {
      type: String,
      required: true,
      maxlength: 1000,
    },

    publishedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Create slug from focusKeyword or title before saving
blogSchema.pre("save", function (next) {
  if (this.isModified("title") || this.isModified("focusKeyword") || this.isNew) {
    // Use focusKeyword if available, otherwise use title
    const sourceText = this.focusKeyword || this.title;
    this.slug = sourceText
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
blogSchema.index({ focusKeyword: 1 });
blogSchema.index({ status: 1 });
blogSchema.index({ category: 1 });
blogSchema.index({ author: 1 });
blogSchema.index({ tags: 1 });
blogSchema.index({ featured: 1 });
blogSchema.index({ publishedAt: -1 });
blogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Blog", blogSchema);
