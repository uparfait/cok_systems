// Maps raw Mongo/Mongoose errors to guidance messages safe to show end users.
function departmentErrorMessage(error, action) {
  if (error && error.code === 11000) {
    const field = Object.keys(error.keyValue || {})[0];
    if (field === 'department_name') {
      return 'A department with this name already exists. Please choose a different name.';
    }
    return 'A department with the same details already exists. Please review the form and try again.';
  }
  if (error && error.name === 'ValidationError') {
    const first = Object.values(error.errors || {})[0];
    if (first && first.message) return first.message;
    return 'Some fields are invalid. Please review the form and try again.';
  }
  if (error && error.name === 'CastError') {
    return 'One of the selected references is invalid. Please refresh the page and try again.';
  }
  return `Something went wrong while ${action}. Please try again or contact the system administrator.`;
}

function isClientError(error) {
  return !!(error && (error.code === 11000 || error.name === 'ValidationError' || error.name === 'CastError'));
}

module.exports = { departmentErrorMessage, isClientError };
