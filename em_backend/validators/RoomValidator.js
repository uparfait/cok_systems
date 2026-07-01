class RoomValidator {
  static validate(data) {
    const errors = [];

    const requiredFields = ['roomName', 'roomDescription', 'roomCapacity', 'roomLocation'];
    for (const field of requiredFields) {
      if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
        errors.push(`${field} is required`);
      }
    }

    if (data.roomName && data.roomName.length > 300) {
      errors.push('Room name cannot exceed 300 characters');
    }

    if (data.roomDescription && data.roomDescription.length > 1000) {
      errors.push('Room description cannot exceed 1000 characters');
    }

    if (data.roomLocation && data.roomLocation.length > 500) {
      errors.push('Room location cannot exceed 500 characters');
    }

    if (data.roomCapacity !== undefined) {
      const capacity = parseInt(data.roomCapacity);
      if (isNaN(capacity) || capacity < 1) {
        errors.push('Room capacity must be a positive number');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static sanitize(data) {
    return {
      roomName: data.roomName ? data.roomName.trim().toLowerCase() : undefined,
      roomDescription: data.roomDescription ? data.roomDescription.trim() : undefined,
      roomCapacity: data.roomCapacity ? parseInt(data.roomCapacity) : undefined,
      roomLocation: data.roomLocation ? data.roomLocation.trim() : undefined,
      isActive: Boolean(data.isActive) || false
    };
  }
}

module.exports = RoomValidator;