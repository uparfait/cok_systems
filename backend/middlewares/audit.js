// Audit Logging Middleware
// Automatically logs critical system actions

const auditRoutes = require('../routes/audit/routes');

// Log audit event
const logAuditEvent = async (action, description, req, additionalData = {}) => {
  try {
    await auditRoutes.logAudit(action, description, req, additionalData);
  } catch (error) {
    console.error('Audit logging failed:', error);
    // Don't throw to avoid breaking main functionality
  }
};

// Middleware to log successful operations
const auditSuccess = (action, resource, getDescription = null) => {
  return async (req, res, next) => {
    // Store original send method
    const originalSend = res.send;
    const originalJson = res.json;

    // Override response methods to capture success
    res.send = function(data) {
      // Log successful responses (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const description = getDescription
          ? getDescription(req, res, data)
          : `${action} operation on ${resource}`;

        logAuditEvent(action, description, req, {
          resource,
          status_code: res.statusCode
        });
      }
      return originalSend.call(this, data);
    };

    res.json = function(data) {
      // Log successful JSON responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const description = getDescription
          ? getDescription(req, res, data)
          : `${action} operation on ${resource}`;

        logAuditEvent(action, description, req, {
          resource,
          status_code: res.statusCode
        });
      }
      return originalJson.call(this, data);
    };

    next();
  };
};

// Middleware to log errors
const auditError = (resource) => {
  return async (err, req, res, next) => {
    // Log error events
    const description = `Error in ${resource}: ${err.message || 'Unknown error'}`;

    await logAuditEvent('ERROR', description, req, {
      resource,
      error_message: err.message,
      status_code: err.status || 500,
      metadata: {
        stack: err.stack,
        url: req.originalUrl,
        method: req.method
      }
    });

    next(err);
  };
};

// Specific audit loggers for common operations
const auditUserActions = {
  // User authentication
  login: (req, res, data) => `User logged in: ${req.body.email || 'unknown'}`,
  logout: (req, res, data) => `User logged out`,

  // User management
  createUser: (req, res, data) => `Created new user: ${data?.data?.email || req.body.email || 'unknown'}`,
  updateUser: (req, res, data) => `Updated user: ${req.params.id || req.body.email || 'unknown'}`,
  deleteUser: (req, res, data) => `Deleted user: ${req.params.id || 'unknown'}`,

  // Employee management
  createEmployee: (req, res, data) => `Created new employee: ${data?.data?.full_name || req.body.full_name || 'unknown'}`,
  updateEmployee: (req, res, data) => `Updated employee: ${req.params.id || req.body.full_name || 'unknown'}`,
  deleteEmployee: (req, res, data) => `Deleted employee: ${req.params.id || 'unknown'}`,

  // Department management
  createDepartment: (req, res, data) => `Created new department: ${data?.data?.department_name || req.body.department_name || 'unknown'}`,
  updateDepartment: (req, res, data) => `Updated department: ${req.params.id || req.body.department_name || 'unknown'}`,
  deleteDepartment: (req, res, data) => `Deleted department: ${req.params.id || 'unknown'}`,

  // Visitor management
  createVisitor: (req, res, data) => `Registered new visitor: ${data?.data?.full_name || req.body.full_name || 'unknown'}`,
  updateVisitor: (req, res, data) => `Updated visitor information: ${req.params.visitorId || req.params.id || 'unknown'}`,
  deleteVisitor: (req, res, data) => `Deleted visitor record: ${req.params.visitorId || req.params.id || 'unknown'}`,

  // Vehicle management
  createVehicle: (req, res, data) => `Registered new vehicle: ${data?.data?.license_plate || req.body.license_plate || 'unknown'}`,
  updateVehicle: (req, res, data) => `Updated vehicle: ${req.params.id || req.body.license_plate || 'unknown'}`,
  deleteVehicle: (req, res, data) => `Deleted vehicle record: ${req.params.id || 'unknown'}`,

  // Parking management
  checkIn: (req, res, data) => `Vehicle checked in: ${req.body.licensePlate || req.body.plate_number || 'unknown'}`,
  checkOut: (req, res, data) => `Vehicle checked out: ${req.body.licensePlate || req.body.plate_number || 'unknown'}`,

  // System operations
  systemError: (req, res, err) => `System error: ${err?.message || 'Unknown error'}`,
  permissionDenied: (req, res, data) => `Permission denied for ${req.method} ${req.originalUrl}`,
  rateLimitExceeded: (req, res, data) => `Rate limit exceeded for ${req.ip}`
};

module.exports = {
  logAuditEvent,
  auditSuccess,
  auditError,
  auditUserActions
};