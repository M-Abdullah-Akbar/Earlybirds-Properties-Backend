const Blog = require("../models/Blog");
const BlogCategory = require("../models/BlogCategory");
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
 * Get all blogs with filtering and pagination
 * Role-based access: Visitors see only published blogs, Admins see all
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getBlogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      status,
      search,
      tags,
      featured,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Start with ACL query filters (set by ACL middleware based on user role)
    const filter = { ...req.queryFilters } || {};

    // Handle status filter based on user role
    const userRole = req.userRole || "visitor";

    if (userRole === "visitor") {
      // Visitors can only see published blogs
      filter.status = "published";
    } else if (status && (userRole === "admin" || userRole === "SuperAdmin")) {
      // Admin and SuperAdmin can filter by any status
      filter.status = status;
    }

    // Apply additional user-specified filters
    if (category) filter.category = category;
    if (featured !== undefined) filter.featured = featured === "true";
    if (tags) {
      const tagArray = tags.split(",").map((tag) => tag.trim());
      filter.tags = { $in: tagArray };
    }

    // Text search
    if (search) {
      filter.$text = { $search: search };
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Sorting
    const sortOptions = {};
    const validSortFields = ["createdAt", "publishedAt", "title"];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    sortOptions[sortField] = sortDirection;

    // Execute query with population
    const [blogs, totalCount] = await Promise.all([
      Blog.find(filter)
        .populate("category", "name slug color")
        .populate("author", "name email")
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Blog.countDocuments(filter),
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    res.status(200).json({
      success: true,
      data: {
        blogs,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount,
          limit: limitNum,
          hasNextPage,
          hasPrevPage,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching blogs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch blogs",
    });
  }
};

/**
 * Get single blog by ID or slug
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.userRole || "visitor";

    // Build query - try to find by ID first, then by slug
    let query;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      // Valid ObjectId
      query = { _id: id };
    } else {
      // Assume it's a slug
      query = { slug: id };
    }

    // Apply ACL filters
    if (userRole === "visitor") {
      query.status = "published";
    }

    const blog = await Blog.findOne(query)
      .populate("category", "name slug color description")
      .populate("author", "name email");

    if (!blog) {
      return res.status(404).json({
        success: false,
        error: "Blog not found",
      });
    }

    // Increment view count for published blogs (visitors only)
    if (userRole === "visitor" && blog.status === "published") {
      await Blog.findByIdAndUpdate(blog._id, { $inc: { views: 1 } });
      blog.views += 1;
    }

    res.status(200).json({
      success: true,
      data: { blog },
    });
  } catch (error) {
    console.error("Error fetching blog:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch blog",
    });
  }
};

/**
 * Create new blog with images
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createBlogWithImages = async (req, res) => {
  try {
    // Additional admin role check
    if (
      !req.user ||
      (req.user.role !== "admin" && req.user.role !== "SuperAdmin")
    ) {
      return res.status(403).json({
        success: false,
        error: "Access denied. Admin privileges required.",
      });
    }

    const blogData = req.validatedData || req.body;
    const processedImages = req.processedImages || [];

    // Validate status if provided
    if (blogData.status) {
      const allowedStatuses = ["draft", "published", "archived"];
      if (!allowedStatuses.includes(blogData.status)) {
        return res.status(400).json({
          success: false,
          error: "Invalid status. Allowed values: draft, published, archived",
        });
      }
    }

    // Handle empty string category (convert to null for optional field)
    if (blogData.category === "") {
      blogData.category = null;
    }

    // Verify category exists
    if (blogData.category) {
      const category = await BlogCategory.findById(blogData.category);
      if (!category) {
        return res.status(400).json({
          success: false,
          error: "Invalid category ID",
        });
      }
    }

    // Create blog with processed images
    const blog = new Blog({
      ...blogData,
      images: processedImages,
      author: req.user.id,
    });

    await blog.save();

    // Populate the response
    const populatedBlog = await Blog.findById(blog._id)
      .populate("category", "name slug color")
      .populate("author", "name email");

    res.status(201).json({
      success: true,
      data: { blog: populatedBlog },
      message: "Blog created successfully",
    });
  } catch (error) {
    console.error("Error creating blog:", error);

    // Clean up uploaded images if blog creation failed
    if (req.processedImages && req.processedImages.length > 0) {
      for (const image of req.processedImages) {
        try {
          await deleteLocalImageFiles(image.publicId);
        } catch (cleanupError) {
          console.error("Error cleaning up image:", cleanupError);
        }
      }
    }

    res.status(500).json({
      success: false,
      error: error.message || "Failed to create blog",
    });
  }
};

/**
 * Update blog (unified - handles both JSON and FormData)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateBlog = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if this is a FormData request (with images) or JSON request (simple update)
    const isFormDataRequest =
      req.processedImages !== undefined || req.validatedData !== undefined;
    const blogData = isFormDataRequest
      ? req.validatedData || req.body
      : req.body;
    const processedImages = req.processedImages || [];

    console.log(
      `🔄 Blog Update - Request type: ${
        isFormDataRequest ? "FormData (with images)" : "JSON (simple)"
      }`
    );

    // Find existing blog
    const existingBlog = await Blog.findById(id);
    if (!existingBlog) {
      return res.status(404).json({
        success: false,
        error: "Blog not found",
      });
    }

    // Check permissions
    if (
      req.user.role !== "SuperAdmin" &&
      existingBlog.author.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        error: "Access denied. You can only update your own blogs.",
      });
    }

    // Validate status transitions
    if (blogData.status && blogData.status !== existingBlog.status) {
      const currentStatus = existingBlog.status;
      const newStatus = blogData.status;

      // Once a blog is published or archived, it cannot go back to draft
      if (currentStatus !== "draft" && newStatus === "draft") {
        return res.status(400).json({
          success: false,
          error:
            "Cannot change status from published or archived back to draft",
        });
      }

      // Validate allowed status values
      const allowedStatuses = ["draft", "published", "archived"];
      if (!allowedStatuses.includes(newStatus)) {
        return res.status(400).json({
          success: false,
          error: "Invalid status. Allowed values: draft, published, archived",
        });
      }
    }

    // Handle empty string category (convert to null for optional field)
    if (blogData.category === "" || blogData.category === null) {
      blogData.category = null;
    }

    // Verify category exists if being updated
    if (blogData.category) {
      const category = await BlogCategory.findById(blogData.category);
      if (!category) {
        return res.status(400).json({
          success: false,
          error: "Invalid category ID",
        });
      }
    }

    // Handle image updates only for FormData requests
    if (isFormDataRequest) {
      let finalImages = [];
      let imageUpdateRequested = false;

      // Handle existing images that should be kept
      if (blogData.existingImages !== undefined) {
        imageUpdateRequested = true;
        try {
          const existingImages = JSON.parse(blogData.existingImages);
          if (Array.isArray(existingImages)) {
            finalImages = [...existingImages];
            console.log(
              `📷 Blog: Keeping ${existingImages.length} existing images`
            );
          }
        } catch (error) {
          console.error("❌ Blog: Error parsing existingImages:", error);
        }
      }

      // Handle new uploaded images
      if (processedImages.length > 0) {
        imageUpdateRequested = true;
        console.log(`📷 Blog: Adding ${processedImages.length} new images`);
        finalImages = [...finalImages, ...processedImages];
      }

      // Process images if any image update was requested
      if (imageUpdateRequested) {
        // Find images that were removed and delete them from local storage
        // Handle both old format (without publicId) and new format (with publicId)
        const currentImageIds = existingBlog.images
          .map((img) => img.publicId || img.url) // Fallback to url for old format
          .filter(Boolean); // Remove any undefined/null values

        const finalImageIds = finalImages
          .map((img) => img.publicId || img.url) // Fallback to url for old format
          .filter(Boolean); // Remove any undefined/null values

        const removedImageIds = currentImageIds.filter(
          (id) => !finalImageIds.includes(id)
        );

        if (removedImageIds.length > 0) {
          console.log(
            `🗑️ BLOG UPDATE DEBUG - Found ${removedImageIds.length} images to delete:`,
            removedImageIds
          );

          // Delete removed images from local storage
          const deletePromises = removedImageIds.map(async (imageId) => {
            try {
              // For old format, imageId might be a URL, extract filename
              let publicId = imageId;
              if (imageId.includes("/")) {
                // Extract filename from URL for old format
                const urlParts = imageId.split("/");
                publicId = urlParts[urlParts.length - 1];
                // Remove file extension if present
                const dotIndex = publicId.lastIndexOf(".");
                if (dotIndex > 0) {
                  publicId = publicId.substring(0, dotIndex);
                }
              }

              await deleteLocalImageFiles(publicId);
              console.log(
                `✅ Successfully deleted local files for removed blog image: ${imageId} (publicId: ${publicId})`
              );
            } catch (error) {
              console.error(
                `❌ Failed to delete local files for blog image ${imageId}:`,
                error
              );
              // Continue with update even if image deletion fails
            }
          });

          await Promise.allSettled(deletePromises);
        }

        // Update blog with image changes
        const updatedBlog = await Blog.findByIdAndUpdate(
          id,
          {
            ...blogData,
            images: finalImages,
            updatedAt: new Date(),
          },
          { new: true, runValidators: true }
        )
          .populate("category", "name slug color")
          .populate("author", "name email");

        res.status(200).json({
          success: true,
          data: { blog: updatedBlog },
          message: "Blog updated successfully",
        });
      } else {
        // No image updates - keep existing images
        const updatedBlog = await Blog.findByIdAndUpdate(
          id,
          {
            ...blogData,
            images: existingBlog.images,
            updatedAt: new Date(),
          },
          { new: true, runValidators: true }
        )
          .populate("category", "name slug color")
          .populate("author", "name email");

        res.status(200).json({
          success: true,
          data: { blog: updatedBlog },
          message: "Blog updated successfully",
        });
      }
    } else {
      // Simple JSON update - no image processing
      const updatedBlog = await Blog.findByIdAndUpdate(
        id,
        {
          ...blogData,
          updatedAt: new Date(),
        },
        { new: true, runValidators: true }
      )
        .populate("category", "name slug color")
        .populate("author", "name email");

      res.status(200).json({
        success: true,
        data: { blog: updatedBlog },
        message: "Blog updated successfully",
      });
    }
  } catch (error) {
    console.error("Error updating blog:", error);

    // Clean up uploaded images if update failed
    if (req.processedImages && req.processedImages.length > 0) {
      for (const image of req.processedImages) {
        try {
          await deleteLocalImageFiles(image.publicId);
        } catch (cleanupError) {
          console.error("Error cleaning up image:", cleanupError);
        }
      }
    }

    res.status(500).json({
      success: false,
      error: error.message || "Failed to update blog",
    });
  }
};

/**
 * Delete blog
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;

    // Find blog
    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({
        success: false,
        error: "Blog not found",
      });
    }

    // Check permissions
    if (
      req.user.role !== "SuperAdmin" &&
      blog.author.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        error: "Access denied. You can only delete your own blogs.",
      });
    }

    // Delete associated images
    const imagesToDelete = [...(blog.images || [])];
    if (blog.featuredImage) {
      imagesToDelete.push(blog.featuredImage);
    }

    // Delete blog
    await Blog.findByIdAndDelete(id);

    // Clean up image files
    for (const image of imagesToDelete) {
      try {
        // Handle both old format (without publicId) and new format (with publicId)
        let publicId = image.publicId || image.url;

        if (publicId && publicId.includes("/")) {
          // Extract filename from URL for old format
          const urlParts = publicId.split("/");
          publicId = urlParts[urlParts.length - 1];
          // Remove file extension if present
          const dotIndex = publicId.lastIndexOf(".");
          if (dotIndex > 0) {
            publicId = publicId.substring(0, dotIndex);
          }
        }

        if (publicId) {
          await deleteLocalImageFiles(publicId);
        }
      } catch (cleanupError) {
        console.error("Error cleaning up image:", cleanupError);
      }
    }

    res.status(200).json({
      success: true,
      message: "Blog deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting blog:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete blog",
    });
  }
};

/**
 * Delete specific image from blog
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteBlogImage = async (req, res) => {
  try {
    const { id, imageId } = req.params;

    // Find blog
    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({
        success: false,
        error: "Blog not found",
      });
    }

    // Check permissions
    if (
      req.user.role !== "SuperAdmin" &&
      blog.createdBy.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        error: "Access denied. You can only modify your own blogs.",
      });
    }

    // Find image to delete
    const imageIndex = blog.images.findIndex(
      (img) => img._id.toString() === imageId
    );

    if (imageIndex === -1) {
      return res.status(404).json({
        success: false,
        error: "Image not found",
      });
    }

    const imageToDelete = blog.images[imageIndex];

    // Remove image from array
    blog.images.splice(imageIndex, 1);
    blog.updatedBy = req.user.id;
    blog.updatedAt = new Date();

    await blog.save();

    // Delete physical file
    try {
      // Handle both old format (without publicId) and new format (with publicId)
      let publicId = imageToDelete.publicId || imageToDelete.url;

      if (publicId && publicId.includes("/")) {
        // Extract filename from URL for old format
        const urlParts = publicId.split("/");
        publicId = urlParts[urlParts.length - 1];
        // Remove file extension if present
        const dotIndex = publicId.lastIndexOf(".");
        if (dotIndex > 0) {
          publicId = publicId.substring(0, dotIndex);
        }
      }

      if (publicId) {
        await deleteLocalImageFiles(publicId);
      }
    } catch (cleanupError) {
      console.error("Error cleaning up image file:", cleanupError);
    }

    res.status(200).json({
      success: true,
      message: "Image deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting blog image:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete image",
    });
  }
};

module.exports = {
  getBlogs,
  getBlog,
  createBlogWithImages,
  updateBlog,
  deleteBlog,
  deleteBlogImage,
};
