/**
 * Audit helpers kept for the many route files and controllers that call
 * them. Storage itself moved to middlewares/audit_response.js, which
 * records every response that is not a 200/201 - so these helpers no
 * longer write rows of their own (that would duplicate every failure and
 * re-introduce success rows). They only enrich the row the response
 * middleware is about to store.
 */

// A controller describing what it was doing (e.g. "Failed TOTP attempt
// 2/5 for x@y") becomes the description of the audit row for that response.
const logAuditEvent = async (action, description, req) => {
  try {
    if (req && description) {
      req.audit_description = action ? `${action}: ${description}` : description;
    }
  } catch (error) {
    console.error('Audit annotation failed:', error);
  }
};

// Successful (2xx) responses are no longer audited - passthrough kept so
// the route definitions that reference it need no change.
const auditSuccess = () => (req, res, next) => next();

// Error handlers hand the real exception message to the response middleware.
const auditError = () => (err, req, res, next) => {
  if (err && err.message) req.audit_error = err.message;
  next(err);
};

// Specific audit loggers for common operations
const auditUserActions = {
  login: (req, res, data) => `User logged in: ${req.body.email || 'unknown'}`,
  logout: (req, res, data) => `User logged out`,
  createUser: (req, res, data) => `Created new user: ${data?.data?.email || req.body.email || 'unknown'}`,
  updateUser: (req, res, data) => `Updated user: ${data?.data?.email || data?.data?.full_name || req.body.email || req.body.full_name || req.params.id || 'unknown'}`,
  deleteUser: (req, res, data) => `Deleted user: ${data?.data?.email || data?.data?.full_name || req.params.id || 'unknown'}`,
  createEmployee: (req, res, data) => `Created new employee: ${data?.data?.full_name || req.body.full_name || 'unknown'}`,
  updateEmployee: (req, res, data) => `Updated employee: ${data?.data?.full_name || req.body.full_name || req.params.id || 'unknown'}`,
  deleteEmployee: (req, res, data) => `Deleted employee: ${data?.data?.full_name || req.params.id || 'unknown'}`,
  createDepartment: (req, res, data) => `Created new department: ${data?.data?.department_name || req.body.department_name || 'unknown'}`,
  updateDepartment: (req, res, data) => `Updated department: ${data?.data?.department_name || req.body.department_name || req.params.id || 'unknown'}`,
  deleteDepartment: (req, res, data) => `Deleted department: ${data?.data?.department_name || req.params.id || 'unknown'}`,
  createVisitor: (req, res, data) => `Registered new visitor: ${data?.data?.full_name || req.body.full_name || 'unknown'}`,
  updateVisitor: (req, res, data) => `Updated visitor information: ${data?.data?.full_name || req.body.full_name || req.params.visitorId || req.params.id || 'unknown'}`,
  deleteVisitor: (req, res, data) => `Deleted visitor record: ${data?.data?.full_name || req.params.visitorId || req.params.id || 'unknown'}`,
  createVehicle: (req, res, data) => `Registered new vehicle: ${data?.data?.license_plate || req.body.license_plate || 'unknown'}`,
  updateVehicle: (req, res, data) => `Updated vehicle: ${data?.data?.license_plate || req.body.license_plate || req.params.id || 'unknown'}`,
  deleteVehicle: (req, res, data) => `Deleted vehicle record: ${data?.data?.license_plate || req.params.id || 'unknown'}`,
  checkIn: (req, res, data) => `Vehicle checked in: ${req.body.licensePlate || req.body.plate_number || 'unknown'}`,
  checkOut: (req, res, data) => `Vehicle checked out: ${req.body.licensePlate || req.body.plate_number || 'unknown'}`,
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
