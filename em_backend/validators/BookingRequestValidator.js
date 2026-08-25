class BookingRequestValidator {
  static validateCreate(data) {
    const errors = [];

    const isVirtual = data.eventFormat === "Virtual";

    // Validate required fields (a room is only required for physical events)
    const requiredFields = [
      "eventName",
      "eventDescription",
      "eventType",
      "eventMeetingType",
    ];
    if (!isVirtual) {
      requiredFields.push("eventRoom");
    }
    for (const field of requiredFields) {
      if (
        !data[field] ||
        (typeof data[field] === "string" && !data[field].trim())
      ) {
        errors.push(`${field} is required`);
      }
    }

    // Validate event format
    if (data.eventFormat && !["Physical", "Virtual"].includes(data.eventFormat)) {
      errors.push("Event format must be either Physical or Virtual");
    }

    if (data.virtualLink) {
      if (data.virtualLink.length > 1000) {
        errors.push("Virtual link cannot exceed 1000 characters");
      } else if (!/^https?:\/\/\S+$/i.test(data.virtualLink.trim())) {
        errors.push("Virtual link must be a valid http(s) URL");
      }
    }

    if (data.virtualDescription && data.virtualDescription.length > 1000) {
      errors.push("Virtual description cannot exceed 1000 characters");
    }

    // Validate eventMeetingType
    if (data.eventMeetingType && !["event", "meet"].includes(data.eventMeetingType)) {
      errors.push("Event meeting type must be either event or meet");
    }

    // Validate event name
    if (data.eventName && data.eventName.length > 500) {
      errors.push("Event name cannot exceed 500 characters");
    }

    // Validate event description
    if (data.eventDescription && data.eventDescription.length > 2000) {
      errors.push("Event description cannot exceed 2000 characters");
    }

    // Validate event type
    if (
      data.eventType &&
      !["Internal", "Joint", "External"].includes(data.eventType)
    ) {
      errors.push("Event type must be Internal, Joint or External");
    }

    // Validate expected audience
    if (data.expectedAudience !== undefined && data.expectedAudience !== null) {
      const audience = Number(data.expectedAudience);
      if (isNaN(audience) || audience < 1) {
        errors.push("Expected audience must be at least 1");
      }
    }

    // Validate organizer
    if (data.eventOrganizer) {
      if (typeof data.eventOrganizer !== "object") {
        errors.push("Event organizer must be an object with fullNames, email, phone and institution");
      } else {
        if (!data.eventOrganizer.fullNames || !data.eventOrganizer.fullNames.trim()) {
          errors.push("Organizer full names is required");
        }
        if (!data.eventOrganizer.email || !data.eventOrganizer.email.trim()) {
          errors.push("Organizer email is required");
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.eventOrganizer.email)) {
          errors.push("Please provide a valid organizer email");
        }
        if (!data.eventOrganizer.phone || !data.eventOrganizer.phone.trim()) {
          errors.push("Organizer phone number is required");
        }
      }
    } else {
      errors.push("Event organizer is required");
    }

    // Validate schedule
    if (!data.startTime) {
      errors.push("Start time is required");
    }
    if (!data.endTime) {
      errors.push("End time is required");
    }
    if (data.startTime && data.endTime) {
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        errors.push("Invalid date format for startTime or endTime");
      } else if (end <= start) {
        errors.push("End time must be after start time");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static sanitizeCreate(data) {
    const sanitized = {};

    sanitized.eventMeetingType = data.eventMeetingType || "event";
    sanitized.eventName = data.eventName ? data.eventName.trim() : "";
    sanitized.eventDescription = data.eventDescription ? data.eventDescription.trim() : "";
    sanitized.eventType = data.eventType ? data.eventType.trim() : "";
    sanitized.eventRoom = data.eventRoom ? data.eventRoom.trim().toLowerCase() : "";
    sanitized.eventFormat = data.eventFormat === "Virtual" ? "Virtual" : "Physical";
    if (sanitized.eventFormat === "Virtual") {
      sanitized.eventRoom = "virtual";
      sanitized.virtualLink = data.virtualLink ? data.virtualLink.trim() : "";
      sanitized.virtualDescription = data.virtualDescription ? data.virtualDescription.trim() : "";
    } else {
      sanitized.virtualLink = "";
      sanitized.virtualDescription = "";
    }
    sanitized.expectedAudience = data.expectedAudience
      ? Number(data.expectedAudience)
      : undefined;

    // Sanitize organizer
    if (data.eventOrganizer && typeof data.eventOrganizer === "object") {
      sanitized.eventOrganizer = {
        fullNames: data.eventOrganizer.fullNames ? data.eventOrganizer.fullNames.trim() : "",
        email: data.eventOrganizer.email ? data.eventOrganizer.email.trim().toLowerCase() : "",
        phone: data.eventOrganizer.phone ? data.eventOrganizer.phone.trim() : "",
        institution: data.eventOrganizer.institution ? data.eventOrganizer.institution.trim() : "",
      };
    }

    // Convert dates
    sanitized.startTime = data.startTime ? new Date(data.startTime) : null;
    sanitized.endTime = data.endTime ? new Date(data.endTime) : null;

    // Sanitize activity agenda
    if (data.activityAgenda && Array.isArray(data.activityAgenda)) {
      sanitized.activityAgenda = data.activityAgenda
        .filter((phase) => {
          return (
            phase.title?.trim() ||
            phase.description?.trim() ||
            phase.fromTime?.trim() ||
            phase.toTime?.trim()
          );
        })
        .map((phase) => ({
          fromTime: phase.fromTime ? phase.fromTime.trim() : "",
          toTime: phase.toTime ? phase.toTime.trim() : "",
          title: phase.title ? phase.title.trim() : "",
          description: phase.description ? phase.description.trim() : "",
        }));
    }

    return sanitized;
  }

  static validateReject(data) {
    const errors = [];
    if (!data.reason || !data.reason.trim()) {
      errors.push("Rejection reason is required");
    } else if (data.reason.length > 1000) {
      errors.push("Rejection reason cannot exceed 1000 characters");
    }
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateUpdate(data) {
    const errors = [];
    const hasAnyField =
      data.startTime || data.endTime || data.eventName || data.eventDescription ||
      data.eventType || data.eventRoom || data.eventMeetingType ||
      data.eventFormat || data.virtualLink !== undefined || data.virtualDescription !== undefined ||
      data.expectedAudience !== undefined || data.activityAgenda !== undefined ||
      (data.eventOrganizer && typeof data.eventOrganizer === "object");
    if (!hasAnyField) {
      errors.push("At least one field must be provided for update");
    }
    if (data.expectedAudience !== undefined) {
      const val = Number(data.expectedAudience);
      if (isNaN(val) || val < 1) {
        errors.push("Expected audience must be at least 1");
      }
    }
    if (data.startTime && data.endTime) {
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        errors.push("Invalid date format");
      } else if (end <= start) {
        errors.push("End time must be after start time");
      }
    }
    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = BookingRequestValidator;