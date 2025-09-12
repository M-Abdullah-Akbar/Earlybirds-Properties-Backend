/**
 * Blog Category Approval Controller (SuperAdmin Only)
 * Handles blog category approval/rejection workflow
 */

const BlogCategory = require("../models/BlogCategory");
const User = require("../models/User");

/**
 * Get blog categories pending approval (SuperAdmin only)
 * @route GET /api/blog-category-approval/pending
 * @access SuperAdmin only
 */
const getPendingCategories = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      createdBy,
    } = req.query;

    // Build query for pending categories
    const query = { approvalStatus: "pending" };

    // Add filters
    if (createdBy) query.createdBy = createdBy;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Get categories with creator info
    const categories = await BlogCategory.find(query)
      .populate("createdBy", "name email username")
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalCategories = await BlogCategory.countDocuments(query);
    const totalPages = Math.ceil(totalCategories / parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        categories,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCategories,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching pending categories:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch pending categories",
    });
  }
};

/**
 * Approve a blog category (SuperAdmin only)
 * @route PATCH /api/blog-category-approval/:id/approve
 * @access SuperAdmin only
 */
const approveCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body; // Optional approval notes

    // Find the category
    const category = await BlogCategory.findById(id).populate(
      "createdBy",
      "name email"
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        error: "Blog category not found",
      });
    }

    // Check if category is pending
    if (category.approvalStatus !== "pending") {
      return res.status(400).json({
        success: false,
        error: `Blog category is already ${category.approvalStatus}`,
      });
    }

    // Update category approval status
    category.approvalStatus = "approved";
    category.updatedBy = req.user.id;
    category.updatedAt = new Date();

    // Clear any previous rejection reason
    category.rejectionReason = undefined;

    await category.save();

    res.status(200).json({
      success: true,
      message: `Blog category "${category.name}" has been approved`,
      data: {
        category: {
          id: category._id,
          name: category.name,
          approvalStatus: category.approvalStatus,
          updatedAt: category.updatedAt,
          updatedBy: category.updatedBy,
          createdBy: category.createdBy,
        },
      },
    });
  } catch (error) {
    console.error("Error approving category:", error);
    res.status(500).json({
      success: false,
      error: "Failed to approve category",
    });
  }
};

/**
 * Reject a blog category (SuperAdmin only)
 * @route PATCH /api/blog-category-approval/:id/reject
 * @access SuperAdmin only
 */
const rejectCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    // Validate rejection reason
    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Rejection reason is required",
      });
    }

    // Find the category
    const category = await BlogCategory.findById(id).populate(
      "createdBy",
      "name email"
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        error: "Blog category not found",
      });
    }

    // Check if category is pending
    if (category.approvalStatus !== "pending") {
      return res.status(400).json({
        success: false,
        error: `Blog category is already ${category.approvalStatus}`,
      });
    }

    // Update category approval status
    category.approvalStatus = "rejected";
    category.updatedBy = req.user.id;
    category.updatedAt = new Date();
    category.rejectionReason = rejectionReason.trim();

    await category.save();

    res.status(200).json({
      success: true,
      message: `Blog category "${category.name}" has been rejected`,
      data: {
        category: {
          id: category._id,
          name: category.name,
          approvalStatus: category.approvalStatus,
          rejectionReason: category.rejectionReason,
          updatedAt: category.updatedAt,
          updatedBy: category.updatedBy,
          createdBy: category.createdBy,
        },
      },
    });
  } catch (error) {
    console.error("Error rejecting category:", error);
    res.status(500).json({
      success: false,
      error: "Failed to reject category",
    });
  }
};

/**
 * Get approval statistics (SuperAdmin only)
 * @route GET /api/blog-category-approval/stats
 * @access SuperAdmin only
 */
const getApprovalStats = async (req, res) => {
  try {
    const stats = await BlogCategory.aggregate([
      {
        $group: {
          _id: "$approvalStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    // Format stats
    const formattedStats = {
      pending: 0,
      approved: 0,
      rejected: 0,
    };

    stats.forEach((stat) => {
      formattedStats[stat._id] = stat.count;
    });

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentActivity = await BlogCategory.find({
      updatedAt: { $gte: thirtyDaysAgo },
      approvalStatus: { $in: ["approved", "rejected"] },
    })
      .populate("createdBy", "name")
      .populate("updatedBy", "name")
      .sort({ updatedAt: -1 })
      .limit(10)
      .select(
        "name approvalStatus updatedAt rejectionReason createdBy updatedBy"
      );

    res.status(200).json({
      success: true,
      data: {
        stats: formattedStats,
        total:
          formattedStats.pending +
          formattedStats.approved +
          formattedStats.rejected,
        recentActivity,
      },
    });
  } catch (error) {
    console.error("Error fetching approval stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch approval statistics",
    });
  }
};

module.exports = {
  getPendingCategories,
  approveCategory,
  rejectCategory,
  getApprovalStats,
};
