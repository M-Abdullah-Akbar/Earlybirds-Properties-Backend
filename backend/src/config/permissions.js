/**
 * Real Estate ACL Permission System
 * Simple permissions for SuperAdmin,admin and visitor roles
 */

const rolePermissions = {
  SuperAdmin: {
    properties: {
      Create: "any",
      Read: "any",
      Update: "any",
      Delete: "any",
      Approve: "any", // SuperAdmin can approve/reject properties
    },
    users: {
      Create: "any",
      Read: "any",
      Update: "own",
      UpdateStatus: "any", // SuperAdmin can update user status (active/inactive)
      Delete: "any",
    },
    blogs: {
      Create: "any",
      Read: "any",
      Update: "any",
      Delete: "any",
    },
    blogCategories: {
      Create: "any",
      Read: "any",
      Update: "any",
      Delete: "any",
      Approve: "any", // SuperAdmin can approve/reject blog categories
    },
  },
  admin: {
    properties: {
      Create: "any",
      Read: "own", // Admin can only read their own properties
      Update: "own", // Admin can only update their own properties
      Delete: "rejected_or_draft", // Admin can only delete their own rejected or draft properties
    },
    users: {
      Read: "own",
      Update: "own",
    },
    blogs: {
      Create: "any",
      Read: "own", // Admin can read their own blogs + published blogs
      Update: "own", // Admin can only update their own blogs
      Delete: "own", // Admin can only delete their own blogs
    },
    blogCategories: {
      Create: "any",
      Read: "any",
      Update: "own", // Admin can only update their own categories
      Delete: "own", // Admin can only delete their own categories
    },
  },
  visitor: {
    properties: {
      Read: "published_only",
    },
    blogs: {
      Read: "published_only",
    },
    blogCategories: {
      Read: "any",
    },
  },
};

// Simple helper to build query filters based on user role
const buildPropertyQuery = (user) => {
  const userRole = user?.role || "visitor";

  if (userRole === "SuperAdmin") {
    // SuperAdmin can see all non-draft properties + their own drafts
    return {
      $or: [
        { status: { $ne: "draft" } }, // All non-draft properties
        { status: "draft", createdBy: user.id }, // Their own drafts
      ],
    };
  } else if (userRole === "admin") {
    // Admin can only see their own properties
    return { createdBy: user.id };
  } else {
    // Visitors can only see published properties
    return { status: { $in: ["available", "sold", "rented", "pending"] } };
  }
};

// Helper to build user query filters (for SuperAdmin user management)
const buildUserQuery = (user) => {
  const userRole = user?.role || "visitor";

  if (userRole === "SuperAdmin") {
    // SuperAdmin can see all users
    return {};
  } else {
    // Others cannot query users
    return { _id: null }; // Return impossible query
  }
};

module.exports = {
  rolePermissions,
  buildPropertyQuery,
  buildUserQuery,
};
