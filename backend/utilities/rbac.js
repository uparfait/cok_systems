/**
 * RBAC (Role-Based Access Control) Utility
 * Defines permissions for each role
 */

// User Roles
const ROLES = {
    SYSTEM_ADMIN: 'system_admin',
    RECEPTIONIST: 'receptionist',
    HEAD_OF_DEPARTMENT: 'head_of_department',
    DEPARTMENT_EMPLOYEE: 'department_employee',
    VEHICLE_REGISTRAR: 'vehicle_registrar',
    ENTRANCE_OFFICER: 'entrance_officer'
};

// Module Types
const MODULES = {
    SMART_PARKING: 'smart_parking',
    SERVICE_DELIVERY: 'service_delivery',
    SYSTEM: 'system'
};

// Permission Types
const PERMISSIONS = {
    // Smart Parking Permissions
    VIEW_PARKING_RECORDS: 'view_parking_records',
    EXPORT_PARKING_RECORDS: 'export_parking_records',
    PLATE_SCANNING: 'plate_scanning',
    VEHICLE_REGISTRATION: 'vehicle_registration',
    MANAGE_PARKING: 'manage_parking',
    
    // Service Delivery Permissions
    VIEW_DELIVERY_RECORDS: 'view_delivery_records',
    EXPORT_DELIVERY_RECORDS: 'export_delivery_records',
    MANAGE_DELIVERIES: 'manage_deliveries',
    
    // System Permissions
    USER_MANAGEMENT: 'user_management',
    SYSTEM_SETTINGS: 'system_settings',
    AUDIT_LOGS: 'audit_logs',
    DEPARTMENT_MANAGEMENT: 'department_management'
};

// Role-Permission Mapping
const ROLE_PERMISSIONS = {
    [ROLES.SYSTEM_ADMIN]: [
        // Smart Parking
        PERMISSIONS.VIEW_PARKING_RECORDS,
        PERMISSIONS.EXPORT_PARKING_RECORDS,
        PERMISSIONS.PLATE_SCANNING,
        PERMISSIONS.VEHICLE_REGISTRATION,
        PERMISSIONS.MANAGE_PARKING,
        // Service Delivery
        PERMISSIONS.VIEW_DELIVERY_RECORDS,
        PERMISSIONS.EXPORT_DELIVERY_RECORDS,
        PERMISSIONS.MANAGE_DELIVERIES,
        // System
        PERMISSIONS.USER_MANAGEMENT,
        PERMISSIONS.SYSTEM_SETTINGS,
        PERMISSIONS.AUDIT_LOGS,
        PERMISSIONS.DEPARTMENT_MANAGEMENT
    ],
    
    [ROLES.RECEPTIONIST]: [
        PERMISSIONS.VIEW_PARKING_RECORDS,
        PERMISSIONS.VIEW_DELIVERY_RECORDS,
        PERMISSIONS.MANAGE_DELIVERIES
    ],
    
    [ROLES.HEAD_OF_DEPARTMENT]: [
        PERMISSIONS.VIEW_PARKING_RECORDS,
        PERMISSIONS.EXPORT_PARKING_RECORDS,
        PERMISSIONS.VIEW_DELIVERY_RECORDS,
        PERMISSIONS.EXPORT_DELIVERY_RECORDS,
        PERMISSIONS.DEPARTMENT_MANAGEMENT
    ],
    
    [ROLES.DEPARTMENT_EMPLOYEE]: [
        PERMISSIONS.VIEW_PARKING_RECORDS,
        PERMISSIONS.VIEW_DELIVERY_RECORDS
    ],
    
    [ROLES.VEHICLE_REGISTRAR]: [
        PERMISSIONS.VIEW_PARKING_RECORDS,
        PERMISSIONS.VEHICLE_REGISTRATION,
        PERMISSIONS.MANAGE_PARKING
    ],
    
    [ROLES.ENTRANCE_OFFICER]: [
        PERMISSIONS.VIEW_PARKING_RECORDS,
        PERMISSIONS.PLATE_SCANNING
    ]
};

/**
 * Check if a role has a specific permission
 * @param {string} role - User role
 * @param {string} permission - Permission to check
 * @returns {boolean}
 */
const hasPermission = (role, permission) => {
    const rolePerms = ROLE_PERMISSIONS[role];
    if (!rolePerms) return false;
    return rolePerms.includes(permission);
};

/**
 * Get all permissions for a role
 * @param {string} role - User role
 * @returns {string[]}
 */
const getRolePermissions = (role) => {
    return ROLE_PERMISSIONS[role] || [];
};

/**
 * Check if role has access to a module
 * @param {string} role - User role
 * @param {string} module - Module name
 * @returns {boolean}
 */
const hasModuleAccess = (role, module) => {
    const rolePerms = ROLE_PERMISSIONS[role] || [];
    
    switch (module) {
        case MODULES.SMART_PARKING:
            return rolePerms.some(p => 
                [PERMISSIONS.VIEW_PARKING_RECORDS, PERMISSIONS.PLATE_SCANNING, 
                 PERMISSIONS.VEHICLE_REGISTRATION, PERMISSIONS.MANAGE_PARKING].includes(p)
            );
        case MODULES.SERVICE_DELIVERY:
            return rolePerms.some(p => 
                [PERMISSIONS.VIEW_DELIVERY_RECORDS, PERMISSIONS.MANAGE_DELIVERIES].includes(p)
            );
        case MODULES.SYSTEM:
            return rolePerms.some(p => 
                [PERMISSIONS.USER_MANAGEMENT, PERMISSIONS.SYSTEM_SETTINGS, 
                 PERMISSIONS.AUDIT_LOGS, PERMISSIONS.DEPARTMENT_MANAGEMENT].includes(p)
            );
        default:
            return false;
    }
};

/**
 * Validate if a role exists
 * @param {string} role - Role to validate
 * @returns {boolean}
 */
const isValidRole = (role) => {
    return Object.values(ROLES).includes(role);
};

/**
 * Get all valid roles
 * @returns {string[]}
 */
const getAllRoles = () => {
    return Object.values(ROLES);
};

module.exports = {
    ROLES,
    MODULES,
    PERMISSIONS,
    ROLE_PERMISSIONS,
    hasPermission,
    getRolePermissions,
    hasModuleAccess,
    isValidRole,
    getAllRoles
};
