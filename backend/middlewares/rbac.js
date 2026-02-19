/**
 * RBAC Middleware
 * Role-Based Access Control for route protection
 */

const jwt = require('../utilities/jwt');
const rbac = require('../utilities/rbac');

/**
 * Verify JWT token and attach user to request
 */
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return res.status(401).json({
            status: false,
            error: 'No token provided',
            message: 'Please login to access this resource'
        });
    }

    const token = jwt.extractToken(authHeader);
    
    if (!token) {
        return res.status(401).json({
            status: false,
            error: 'Invalid token format',
            message: 'Use Bearer token'
        });
    }

    const verification = jwt.verifyAccessToken(token);
    
    if (!verification.valid) {
        return res.status(401).json({
            status: false,
            error: verification.error,
            message: 'Token expired or invalid'
        });
    }

    // Attach user to request
    req.user = verification.decoded;
    next();
};

/**
 * Check if user has required role
 * @param {string|string[]} roles - Allowed roles
 */
const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                status: false,
                error: 'Not authenticated',
                message: 'Please login first'
            });
        }

        const userRole = req.user.role;
        
        // Convert single role to array
        const allowedRoles = Array.isArray(roles[0]) ? roles[0] : roles;

        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                status: false,
                error: 'Access denied',
                message: `This resource requires one of: ${allowedRoles.join(', ')}`
            });
        }

        next();
    };
};

/**
 * Check if user has specific permission
 * @param {string|string[]} permissions - Required permissions
 */
const requirePermission = (...permissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                status: false,
                error: 'Not authenticated',
                message: 'Please login first'
            });
        }

        const userRole = req.user.role;
        
        // Check if user has ANY of the permissions
        const hasRequiredPermission = permissions.some(perm => 
            rbac.hasPermission(userRole, perm)
        );

        if (!hasRequiredPermission) {
            return res.status(403).json({
                status: false,
                error: 'Access denied',
                message: `You don't have permission to access this resource`
            });
        }

        next();
    };
};

/**
 * Check if user has access to a module
 * @param {string} module - Module name
 */
const requireModuleAccess = (module) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                status: false,
                error: 'Not authenticated',
                message: 'Please login first'
            });
        }

        const userRole = req.user.role;
        
        if (!rbac.hasModuleAccess(userRole, module)) {
            return res.status(403).json({
                status: false,
                error: 'Access denied',
                message: `You don't have access to ${module} module`
            });
        }

        next();
    };
};

module.exports = {
    authenticate,
    authorizeRoles,
    requirePermission,
    requireModuleAccess
};
