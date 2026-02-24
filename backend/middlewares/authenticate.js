/**
 * Authentication Middleware
 * Verifies JWT Bearer token and compares data with database for security
 */

const jwt = require("../utilities/jwt");
const User = require("../models/user");

/**
 * Authentication middleware
 * - Verifies JWT Bearer token
 * - Compares token payload with database data
 * - Attaches fresh user data to request
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Check if Authorization header exists
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        type: "warning",
        message: "No token provided",
        error: "Authorization header is required"
      });
    }

    // Extract Bearer token
    const token = jwt.extractToken(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        type: "warning",
        message: "Invalid token format",
        error: "Use Bearer <token> format"
      });
    }

    // Verify JWT token
    const verification = jwt.verifyAccessToken(token);

    if (!verification.valid) {
      return res.status(401).json({
        success: false,
        type: "warning",
        message: "Token expired or invalid",
        error: verification.error
      });
    }

    // Get token payload
    const tokenPayload = verification.decoded;

    // Fetch user from database
    const user = await User.findById(tokenPayload.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        type: "warning",
        message: "User not found",
        error: "User associated with token no longer exists"
      });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        type: "warning",
        message: "Account is inactive",
        error: "Your account has been deactivated"
      });
    }

    // Check if account is activated
    if (!user.is_account_activated) {
      return res.status(403).json({
        success: false,
        type: "warning",
        message: "Account not activated",
        error: "Please activate your account first"
      });
    }

    // Check if account is locked
    if (user.access_control?.is_locked) {
      return res.status(403).json({
        success: false,
        type: "warning",
        message: "Account is locked",
        error: user.access_control?.reason || "Your account has been locked. Please contact administrator."
      });
    }

    // Compare token data with database data for security
    const tokenUserId = tokenPayload.userId?.toString();
    const tokenEmail = tokenPayload.email?.toLowerCase();
    const tokenRole = tokenPayload.role;
    const tokenPermissions = tokenPayload.permissions || [];

    const dbUserId = user._id?.toString();
    const dbEmail = user.email?.toLowerCase();
    const dbRole = user.roles?.role_name || 'system_admin';
    const dbPermissions = user.roles?.permissions || [];

    // Compare userId
    if (tokenUserId !== dbUserId) {
      return res.status(401).json({
        success: false,
        type: "warning",
        message: "Token data mismatch",
        error: "User ID in token does not match database"
      });
    }

    // Compare email
    if (tokenEmail !== dbEmail) {
      return res.status(401).json({
        success: false,
        type: "warning",
        message: "Token data mismatch",
        error: "Email in token does not match database"
      });
    }

    // Compare role
    if (tokenRole !== dbRole) {
      // Role changed - log this security event
      console.warn(`[SECURITY] User ${user.email} role changed from ${tokenRole} to ${dbRole}`);
      
      // Update token role in payload for this request
      tokenPayload.role = dbRole;
    }

    // Compare permissions - check if database has different permissions
    const tokenPermsSet = new Set(tokenPermissions.map(p => 
      typeof p === 'object' ? JSON.stringify(p) : p
    ));
    const dbPermsSet = new Set(dbPermissions.map(p => 
      typeof p === 'object' ? JSON.stringify(p) : p
    ));

    let permissionsChanged = false;
    if (tokenPermsSet.size !== dbPermsSet.size) {
      permissionsChanged = true;
    } else {
      for (const perm of tokenPermsSet) {
        if (!dbPermsSet.has(perm)) {
          permissionsChanged = true;
          break;
        }
      }
    }

    if (permissionsChanged) {
      // Permissions changed - log this security event
      console.warn(`[SECURITY] User ${user.email} permissions have been updated`);
      
      // Update token permissions in payload for this request
      tokenPayload.permissions = dbPermissions;
    }

    // Attach fresh user data to request
    req.user = {
      userId: user._id,
      email: user.email,
      fullName: user.full_name,
      role: dbRole,
      permissions: dbPermissions,
      departmentId: user.department_id,
      departmentName: user.department_name
    };

    // Also attach the raw token payload for reference
    req.tokenPayload = tokenPayload;

    next();

  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(500).json({
      success: false,
      type: "error",
      message: "Authentication failed",
      error: error.message
    });
  }
};

module.exports = authenticate;
