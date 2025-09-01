/**
 * Property Approval Controller (SuperAdmin Only)
 * Handles property approval/rejection workflow
 */

const Property = require("../models/Property");
const User = require("../models/User");

/**
 * Get properties pending approval (SuperAdmin only)
 * @route GET /api/properties/pending-approval
 * @access SuperAdmin only
 */
const getPendingProperties = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      propertyType,
      emirate,
      createdBy,
    } = req.query;

    // Build query for pending properties
    const query = { approvalStatus: "pending" };

    // Add filters
    if (propertyType) query.propertyType = propertyType;
    if (emirate) query["location.emirate"] = emirate;
    if (createdBy) query.createdBy = createdBy;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Get properties with creator info
    const properties = await Property.find(query)
      .populate("createdBy", "name email username")
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalProperties = await Property.countDocuments(query);
    const totalPages = Math.ceil(totalProperties / parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        properties,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalProperties,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching pending properties:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch pending properties",
    });
  }
};

/**
 * Approve a property (SuperAdmin only)
 * @route PATCH /api/properties/:id/approve
 * @access SuperAdmin only
 */
const approveProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body; // Optional approval notes

    // Find the property
    const property = await Property.findById(id).populate(
      "createdBy",
      "name email"
    );

    if (!property) {
      return res.status(404).json({
        success: false,
        error: "Property not found",
      });
    }

    // Check if property is pending
    if (property.approvalStatus !== "pending") {
      return res.status(400).json({
        success: false,
        error: `Property is already ${property.approvalStatus}`,
      });
    }

    // Update property approval status
    property.approvalStatus = "approved";
    property.updatedBy = req.user.id;
    property.updatedAt = new Date();

    // Clear any previous rejection reason
    property.rejectionReason = undefined;

    await property.save();

    res.status(200).json({
      success: true,
      message: `Property "${property.title}" has been approved`,
      data: {
        property: {
          id: property._id,
          title: property.title,
          approvalStatus: property.approvalStatus,
          updatedAt: property.updatedAt,
          updatedBy: property.updatedBy,
          createdBy: property.createdBy,
        },
      },
    });
  } catch (error) {
    console.error("Error approving property:", error);
    res.status(500).json({
      success: false,
      error: "Failed to approve property",
    });
  }
};

/**
 * Reject a property (SuperAdmin only)
 * @route PATCH /api/properties/:id/reject
 * @access SuperAdmin only
 */
const rejectProperty = async (req, res) => {
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

    // Find the property
    const property = await Property.findById(id).populate(
      "createdBy",
      "name email"
    );

    if (!property) {
      return res.status(404).json({
        success: false,
        error: "Property not found",
      });
    }

    // Check if property is pending
    if (property.approvalStatus !== "pending") {
      return res.status(400).json({
        success: false,
        error: `Property is already ${property.approvalStatus}`,
      });
    }

    // Update property approval status
    property.approvalStatus = "rejected";
    property.updatedBy = req.user.id;
    property.updatedAt = new Date();
    property.rejectionReason = rejectionReason.trim();

    await property.save();

    res.status(200).json({
      success: true,
      message: `Property "${property.title}" has been rejected`,
      data: {
        property: {
          id: property._id,
          title: property.title,
          approvalStatus: property.approvalStatus,
          rejectionReason: property.rejectionReason,
          updatedAt: property.updatedAt,
          updatedBy: property.updatedBy,
          createdBy: property.createdBy,
        },
      },
    });
  } catch (error) {
    console.error("Error rejecting property:", error);
    res.status(500).json({
      success: false,
      error: "Failed to reject property",
    });
  }
};

/**
 * Get approval statistics (SuperAdmin only)
 * @route GET /api/properties/approval-stats
 * @access SuperAdmin only
 */
const getApprovalStats = async (req, res) => {
  try {
    const stats = await Property.aggregate([
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

    const recentActivity = await Property.find({
      updatedAt: { $gte: thirtyDaysAgo },
      approvalStatus: { $in: ["approved", "rejected"] },
    })
      .populate("createdBy", "name")
      .populate("updatedBy", "name")
      .sort({ updatedAt: -1 })
      .limit(10)
      .select(
        "title approvalStatus updatedAt rejectionReason createdBy updatedBy"
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
  getPendingProperties,
  approveProperty,
  rejectProperty,
  getApprovalStats,
};
