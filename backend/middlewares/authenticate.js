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
        goto_login: true,
        type: "warning",
        message: "Your are required to login",
        error: "Authorization header is required: Login first to get a token"
      });
    }

    // Extract Bearer token
    const token = jwt.extractToken(authHeader);

    if (!token) {

        return res.status(401).json({
        success: false,
        goto_login: true,
        type: "warning",
        message: "Your are required to login",
        error: "Authorization Failed: token is malformed. Login first to get a valid token"
      });
    }

    // Verify JWT token
    const verification = jwt.verifyAccessToken(token);

    if (!verification.valid) {
      return res.status(401).json({
        success: false,
        type: "warning",
        goto_login: true,
        message: "Your are required to login",
        error: verification.error
      });
    }

    // Get token payload
    const tokenPayload = verification.decoded;

    // Fetch user from database
    const user = await User.findById(tokenPayload.userId).populate('department');

    if (!user) {
      return res.status(401).json({
        success: false,
        goto_login: true,
        type: "warning",
        message: "Sorry we can't find your account yet!",
        error: "User associated with token no longer exists"
      });
    }

    // Check if account is activated
    if (!user.is_account_activated) {
      return res.status(403).json({
        success: false,
        goto_login: false,
        type: "warning",
        message: "Account not activated",
        error: "Please activate your account first"
      });
    }

    // Check if account is locked
    if (user.access_control?.is_locked) {
      return res.status(403).json({
        success: false,
        goto_login: false,
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
    const dbRole = user.roles?.role_name || 'Not specified'; // Changed default to match schema
    const dbPermissions = user.roles?.permissions || [];

    // Compare userId
    if (tokenUserId !== dbUserId) {
      return res.status(401).json({
        success: false,
        type: "warning",
        goto_login: true,
        message: "I:: Data corrupted!",
        error: "Some user data may be corrupted!"
      });
    }

    // Compare email
    if (tokenEmail !== dbEmail) {
      return res.status(401).json({
        success: false,
        type: "warning",
        goto_login: true,
        message: "E:: Data corrupted!",
        error: "Some user data may be corrupted!"
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
    // Create a string representation for comparison that handles the nested structure
    const tokenPermsSet = new Set(
      tokenPermissions.map(p => 
        typeof p === 'object' ? JSON.stringify(p) : p
      )
    );
    
    const dbPermsSet = new Set(
      dbPermissions.map(p => 
        typeof p === 'object' ? JSON.stringify(p) : p
      )
    );

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

    // Get department information if it exists
    let department = null;
    if (user.department) {
      department = user.department;
    }

    // Attach fresh user data to request
    req.user = {
      userId: user._id,
      id: user._id,
      email: user.email,
      _id: user._id,
      fullName: user.full_name,
      name: user.full_name,
      full_name: user.full_name,
      telephone: user.telephone,
      gender: user.gender, 
      title: user.title,
      role: dbRole,
      role_name: dbRole,
      permissions: dbPermissions,
      department: department,
      is_active: user.is_active,
      is_account_activated: user.is_account_activated,
      access_control: user.access_control,
      department_unit: user.department_unit
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
      error: "Authentication failed"
    });
  }
};

module.exports = authenticate;