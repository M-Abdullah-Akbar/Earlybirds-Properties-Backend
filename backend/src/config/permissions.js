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
    },
    users: {
      Create: "any",
      Read: "any",
      Update: "any",
      Delete: "any",
    },
  },
  admin: {
    properties: {
      Create: "any",
      Read: "any",
      Update: "own", // Admin can only update their own properties
      Delete: "own", // Admin can only delete their own properties
    },
    users: {
      Read: "own",
      Update: "own",
      Delete: "own",
    },
  },
  visitor: {
    properties: {
      Read: "published_only",
    },
  },
};

// Simple helper to build query filters based on user role
const buildPropertyQuery = (user) => {
  const userRole = user?.role || "visitor";

  if (userRole === "SuperAdmin" || userRole === "admin") {
    // SuperAdmin and Admin can see all properties
    return {};
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
