/**
 * Real Estate ACL (Access Control List) Middleware
 * Simple permission control for admin and visitor roles
 */

const {
  rolePermissions,
  buildPropertyQuery,
  buildUserQuery,
} = require("../config/permissions");

/**
 * Simple permission checker middleware
 * @param {string} resource - Resource type (properties)
 * @param {string} action - Action type (Create, Read, Update, Delete)
 * @returns {Function} Express middleware function
 */
const checkPermission = (resource, action) => {
  return async (req, res, next) => {
    try {
      const userRole = req.user?.role || "visitor";
      const userPermissions = rolePermissions[userRole];

      // Check if role has access to this resource
      if (!userPermissions || !userPermissions[resource]) {
        return res.status(403).json({
          success: false,
          error: "Access denied - Resource not accessible",
        });
      }

      // Check if role has permission for this action
      const permissionLevel = userPermissions[resource][action];
      if (!permissionLevel) {
        return res.status(403).json({
          success: false,
          error: "Access denied - Action not permitted",
        });
      }

      // Store user role and permission info for controller
      req.userRole = userRole;
      req.permissionLevel = permissionLevel;

      // Set query filters based on resource and user role
      if (resource === "properties" && action === "Read") {
        req.queryFilters = buildPropertyQuery(req.user);
      } else if (resource === "users" && action === "Read") {
        req.queryFilters = buildUserQuery(req.user);
      }

      // For "own" permissions, we need to check ownership in the controller
      if (permissionLevel === "own") {
        req.requireOwnership = true;

        // For users resource with "own" permission, check if accessing own profile
        if (resource === "users") {
          const requestedUserId = req.params.id;
          const currentUserId = req.user.id.toString(); // Convert ObjectId to string

          if (requestedUserId && requestedUserId !== currentUserId) {
            return res.status(403).json({
              success: false,
              error: "Access denied - You can only access your own profile",
            });
          }
        }
      }

      next();
    } catch (error) {
      console.error("Permission check failed:", error);
      return res.status(500).json({
        success: false,
        error: "Permission check failed",
      });
    }
  };
};

module.exports = {
  checkPermission,
};
