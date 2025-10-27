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

    // Build query - try to find by ID first, then by slug, then by focus keyword
    let query;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      // Valid ObjectId
      query = { _id: id };
    } else {
      // Try by slug first, then by focus keyword
      query = { slug: id };
    }

    // Apply ACL filters
    if (userRole === "visitor") {
      query.status = "published";
    }

    let blog = await Blog.findOne(query)
      .populate("category", "name slug color description")
      .populate("author", "name email");

    // If not found by slug and it's not an ObjectId, try by focus keyword
    if (!blog && !id.match(/^[0-9a-fA-F]{24}$/)) {
      const focusKeywordQuery = { focusKeyword: id };
      if (userRole === "visitor") {
        focusKeywordQuery.status = "published";
      }
      
      blog = await Blog.findOne(focusKeywordQuery)
        .populate("category", "name slug color description")
        .populate("author", "name email");
    }

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
 * Create new blog
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createBlog = async (req, res) => {
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

    const blogData = req.body;

    // Verify category exists if provided
    if (blogData.category) {
      const category = await BlogCategory.findById(blogData.category);
      if (!category) {
        return res.status(400).json({
          success: false,
          error: "Invalid category ID",
        });
      }
    }

    // Create blog
    const blog = new Blog({
      ...blogData,
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
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create blog",
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
    const processedImages = req.uploadedImages || req.processedImages || [];

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

    // Validate that we have exactly 1 image for blogs
    if (processedImages.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Exactly one image is required for blogs",
        details: [
          {
            field: "images",
            message: "Exactly one image is required for blogs",
          },
        ],
      });
    }

    if (processedImages.length > 1) {
      return res.status(400).json({
        success: false,
        error: "Blogs can only have one image. Please remove extra images.",
        details: [
          {
            field: "images",
            message: "Blogs can only have one image. Please remove extra images.",
          },
        ],
      });
    }

    // Map processed images to blog schema format
    const blogImages = processedImages.map((img, index) => ({
      url: img.url,
      alt: img.altText || `Blog image ${index + 1}`,
      caption: img.caption || '',
    }));

    // Create blog with processed images
    const blog = new Blog({
      ...blogData,
      images: blogImages,
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
    if (req.uploadedImages && req.uploadedImages.length > 0) {
      for (const image of req.uploadedImages) {
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
 * Update blog (simple JSON version)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateBlogSimple = async (req, res) => {
  try {
    const { id } = req.params;
    const blogData = req.body;

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

    // Update blog using save() to trigger pre-save hooks (including focus keyword conversion)
    Object.assign(existingBlog, blogData);
    existingBlog.updatedAt = new Date();
    
    const updatedBlog = await existingBlog.save();
    
    // Populate the response
    await updatedBlog.populate("category", "name slug color");
    await updatedBlog.populate("author", "name email");

    res.status(200).json({
      success: true,
      data: { blog: updatedBlog },
      message: "Blog updated successfully",
    });
  } catch (error) {
    console.error("Error updating blog:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update blog",
    });
  }
};

/**
 * Update blog (with images)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const blogData = req.validatedData || req.body;
    const processedImages = req.uploadedImages || req.processedImages || [];

    // Debug logging
    console.log("🔍 BLOG UPDATE DEBUG:");
    console.log("- blogData.existingImages:", blogData.existingImages);
    console.log("- processedImages length:", processedImages.length);
    console.log("- req.body keys:", Object.keys(req.body));
    console.log("- req.files:", req.files ? req.files.length : "undefined");

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

    // Handle image updates
    let updatedImages = [];

    // Handle existing images that should be kept
    if (blogData.existingImages !== undefined) {
      console.log("📷 Processing existingImages:", blogData.existingImages);
      try {
        const existingImages = JSON.parse(blogData.existingImages);
        if (Array.isArray(existingImages)) {
          updatedImages = [...existingImages];
          console.log(`📷 Keeping ${existingImages.length} existing images:`, existingImages.map(img => ({ _id: img._id, url: img.url })));
        }
      } catch (error) {
        console.error("❌ Error parsing existingImages:", error);
        console.error("❌ Raw existingImages value:", blogData.existingImages);
      }
    } else {
      console.log("📷 No existingImages field found in blogData");
    }

    // Handle new uploaded images
    if (processedImages.length > 0) {
      console.log(`📷 Adding ${processedImages.length} new images`);
      
      const newImages = processedImages.map((image, index) => {
        // Get metadata from imageMetadata if available
        const metadata = req.imageMetadata && req.imageMetadata[index] 
          ? req.imageMetadata[index] 
          : {};

        return {
          url: image.url,
          publicId: image.publicId,
          altText: metadata.altText || `Blog image ${updatedImages.length + index + 1}`,
          order: updatedImages.length + index,
          isMain: metadata.isMain === "true" || metadata.isMain === true,
          originalName: image.originalName,
          size: image.size,
          format: image.format,
          width: image.width,
          height: image.height,
        };
      });

      updatedImages = [...updatedImages, ...newImages];
    }

    // If no image data is provided at all, keep existing images unchanged
    if (blogData.existingImages === undefined && processedImages.length === 0) {
      console.log("📷 No image changes requested, keeping existing images");
      updatedImages = existingBlog.images || [];
    }

    // Validate that we have exactly 1 image for blogs
    if (updatedImages.length === 0) {
      return res.status(400).json({
        success: false,
        error: "At least one image is required for blogs",
        details: [
          {
            field: "images",
            message: "At least one image is required for blogs",
          },
        ],
      });
    }

    if (updatedImages.length > 1) {
      return res.status(400).json({
        success: false,
        error: "Blogs can only have one image. Please remove extra images.",
        details: [
          {
            field: "images",
            message: "Blogs can only have one image. Please remove extra images.",
          },
        ],
      });
    }

    // Ensure only one image is marked as main
    if (updatedImages.length > 0) {
      const mainImages = updatedImages.filter((img) => img.isMain);
      if (mainImages.length > 1) {
        // If multiple images are marked as main, keep only the first one
        let foundMain = false;
        updatedImages = updatedImages.map((img) => {
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
        updatedImages[0].isMain = true;
      }

      // Update order to be sequential
      updatedImages = updatedImages.map((img, index) => ({
        ...img,
        order: index,
      }));
    }

    // Debug final images array
    console.log("📷 Final updatedImages array:", updatedImages.map(img => ({ 
      _id: img._id, 
      url: img.url, 
      isMain: img.isMain,
      isExisting: img._id ? true : false 
    })));

    // Update blog using save() to trigger pre-save hooks (including focus keyword conversion)
    Object.assign(existingBlog, blogData);
    existingBlog.images = updatedImages;
    existingBlog.updatedAt = new Date();
    
    const updatedBlog = await existingBlog.save();
    
    // Populate the response
    await updatedBlog.populate("category", "name slug color");
    await updatedBlog.populate("author", "name email");

    res.status(200).json({
      success: true,
      data: { blog: updatedBlog },
      message: "Blog updated successfully",
    });
  } catch (error) {
    console.error("Error updating blog:", error);

    // Clean up uploaded images if update failed
    if (req.uploadedImages && req.uploadedImages.length > 0) {
      for (const image of req.uploadedImages) {
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
        await deleteLocalImageFiles(image.publicId);
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
      blog.author.toString() !== req.user.id
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
    // updatedAt is automatically handled by Mongoose timestamps

    await blog.save();

    // Delete physical file
    try {
      await deleteLocalImageFiles(imageToDelete.publicId);
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

/**
 * Set image as main blog image
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const setMainBlogImage = async (req, res) => {
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
      blog.author.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        error: "Access denied. You can only modify your own blogs.",
      });
    }

    // Find image
    const imageIndex = blog.images.findIndex(
      (img) => img._id.toString() === imageId
    );

    if (imageIndex === -1) {
      return res.status(404).json({
        success: false,
        error: "Image not found",
      });
    }

    // Set all images to not main, then set the selected one as main
    blog.images.forEach((img, index) => {
      img.isMain = index === imageIndex;
    });

    // updatedAt is automatically handled by Mongoose timestamps

    await blog.save();

    res.status(200).json({
      success: true,
      message: "Main image updated successfully",
    });
  } catch (error) {
    console.error("Error setting main blog image:", error);
    res.status(500).json({
      success: false,
      error: "Failed to set main image",
    });
  }
};

module.exports = {
  getBlogs,
  getBlog,
  createBlog,
  createBlogWithImages,
  updateBlogSimple,
  updateBlog,
  deleteBlog,
  deleteBlogImage,
  setMainBlogImage,
};
