const BlogCategory = require("../models/BlogCategory");
const Blog = require("../models/Blog");

/**
 * Get all blog categories with filtering and pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getBlogCategories = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      isActive,
      approvalStatus,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build filter
    const filter = {};

    // Apply active filter
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    // Apply approval status filter
    if (approvalStatus) {
      filter.approvalStatus = approvalStatus;
    }

    // Text search - using regex for partial matching (name, creator name, creator role)
    if (search) {
      const searchRegex = new RegExp(search, "i"); // Case-insensitive regex

      // First, find users that match the search criteria (name or role)
      const User = require("../models/User");
      const matchingUsers = await User.find({
        $or: [{ name: searchRegex }, { role: searchRegex }],
      })
        .select("_id")
        .lean();

      const matchingUserIds = matchingUsers.map((user) => user._id);

      // Build search filter for categories
      const searchConditions = [{ name: searchRegex }];

      // Add creator ID condition if we found matching users
      if (matchingUserIds.length > 0) {
        searchConditions.push({ createdBy: { $in: matchingUserIds } });
      }

      filter.$or = searchConditions;
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Sorting
    const sortOptions = {};
    const validSortFields = ["createdAt", "name", "updatedAt"];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    sortOptions[sortField] = sortDirection;

    // Execute query with population
    const [categories, totalCount] = await Promise.all([
      BlogCategory.find(filter)
        .populate("createdBy", "name email role")
        .populate("updatedBy", "name email role")
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      BlogCategory.countDocuments(filter),
    ]);

    // Get blog counts for each category
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const blogCount = await Blog.countDocuments({
          category: category._id,
          status: "published",
        });

        // Debug log to check if rejectionReason is present
        if (category.approvalStatus === "rejected") {
          console.log(`🔍 Debug - Category "${category.name}":`, {
            approvalStatus: category.approvalStatus,
            rejectionReason: category.rejectionReason,
            hasRejectionReason: !!category.rejectionReason,
          });
        }

        return {
          ...category,
          blogCount,
        };
      })
    );

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    res.status(200).json({
      success: true,
      data: {
        categories: categoriesWithCounts,
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
    console.error("Error fetching blog categories:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch blog categories",
    });
  }
};

/**
 * Get single blog category by ID or slug
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getBlogCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Build query - try to find by ID first, then by slug
    let query;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      // Valid ObjectId
      query = { _id: id };
    } else {
      // Assume it's a slug
      query = { slug: id };
    }

    const category = await BlogCategory.findOne(query)
      .populate("createdBy", "name email role")
      .populate("updatedBy", "name email role");

    if (!category) {
      return res.status(404).json({
        success: false,
        error: "Blog category not found",
      });
    }

    // Get blog count for this category
    const blogCount = await Blog.countDocuments({
      category: category._id,
      status: "published",
    });

    res.status(200).json({
      success: true,
      data: {
        category: {
          ...category.toObject(),
          blogCount,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching blog category:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch blog category",
    });
  }
};

/**
 * Create new blog category
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createBlogCategory = async (req, res) => {
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

    const { name, description, isActive } = req.body;

    // Create category
    const category = new BlogCategory({
      name: name, // Already trimmed by validation middleware
      description: description, // Already trimmed by validation middleware
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user.id,
      // Auto-approve categories created by SuperAdmin
      approvalStatus: req.user.role === "SuperAdmin" ? "approved" : "pending",
    });

    await category.save();

    // Populate the response
    const populatedCategory = await BlogCategory.findById(
      category._id
    ).populate("createdBy", "name email role");

    res.status(201).json({
      success: true,
      data: { category: populatedCategory },
      message: "Blog category created successfully",
    });
  } catch (error) {
    console.error("Error creating blog category:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create blog category",
    });
  }
};

/**
 * Update blog category
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateBlogCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    // Find existing category
    const existingCategory = await BlogCategory.findById(id);
    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        error: "Blog category not found",
      });
    }

    // Check permissions
    if (
      req.user.role !== "SuperAdmin" &&
      existingCategory.createdBy.toString() !== req.user.id.toString()
    ) {
      return res.status(403).json({
        success: false,
        error: "Access denied. You can only update your own categories.",
      });
    }

    // Validation is now handled by middleware

    // Update category
    const updateData = {
      updatedBy: req.user.id,
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name; // Already trimmed by validation middleware
    if (description !== undefined) updateData.description = description; // Already trimmed by validation middleware
    if (isActive !== undefined) updateData.isActive = isActive;

    // Reset approval status for admin updates (SuperAdmin updates stay approved)
    if (req.user.role === "admin") {
      updateData.approvalStatus = "pending";
      updateData.$unset = { rejectionReason: 1 }; // Remove rejection reason field
    } else if (req.user.role === "SuperAdmin") {
      // SuperAdmin updates keep the category approved
      updateData.approvalStatus = "approved";
      updateData.$unset = { rejectionReason: 1 }; // Remove rejection reason field
    }

    const updatedCategory = await BlogCategory.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate("createdBy", "name email role")
      .populate("updatedBy", "name email role");

    res.status(200).json({
      success: true,
      data: { category: updatedCategory },
      message: "Blog category updated successfully",
    });
  } catch (error) {
    console.error("Error updating blog category:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update blog category",
    });
  }
};

/**
 * Delete blog category
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteBlogCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Find category
    const category = await BlogCategory.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        error: "Blog category not found",
      });
    }

    // Check permissions
    if (
      req.user.role !== "SuperAdmin" &&
      category.createdBy.toString() !== req.user.id.toString()
    ) {
      return res.status(403).json({
        success: false,
        error: "Access denied. You can only delete your own categories.",
      });
    }

    // Additional check for admins: cannot delete approved or pending categories
    if (
      req.user.role !== "SuperAdmin" &&
      (category.approvalStatus === "approved" ||
        category.approvalStatus === "pending")
    ) {
      const statusText =
        category.approvalStatus === "approved"
          ? "approved"
          : "pending approval";
      return res.status(403).json({
        success: false,
        error: `Cannot delete ${statusText} categories. Please contact a Super Admin if you need to remove this category.`,
      });
    }

    // Check if category has associated blogs
    const blogCount = await Blog.countDocuments({ category: id });
    if (blogCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete category. It has ${blogCount} associated blog(s). Please reassign or delete the blogs first.`,
      });
    }

    // Delete category
    await BlogCategory.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Blog category deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting blog category:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete blog category",
    });
  }
};

module.exports = {
  getBlogCategories,
  getBlogCategory,
  createBlogCategory,
  updateBlogCategory,
  deleteBlogCategory,
};
