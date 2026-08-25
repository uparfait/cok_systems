class EventValidator {
  static validateEventData(data) {
    const errors = [];

    const isVirtual = data.eventFormat === "Virtual";

    // Validate required fields (a room is only required for physical events)
    const requiredFields = ["eventName", "eventDescription", "eventType"];
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

    // Validate organizer (new structure)
    if (data.eventOrganizer) {
      if (typeof data.eventOrganizer !== "object") {
        errors.push(
          "Event organizer must be an object with fullNames, email, phone and institution",
        );
      } else {
        // Validate fullNames
        if (
          !data.eventOrganizer.fullNames ||
          !data.eventOrganizer.fullNames.trim()
        ) {
          errors.push("Organizer full names is required");
        } else if (data.eventOrganizer.fullNames.length > 200) {
          errors.push("Organizer full names cannot exceed 200 characters");
        }

        // Validate email
        if (!data.eventOrganizer.email || !data.eventOrganizer.email.trim()) {
          errors.push("Organizer email is required");
        } else if (data.eventOrganizer.email.length > 300) {
          errors.push("Organizer email cannot exceed 300 characters");
        } else if (
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.eventOrganizer.email)
        ) {
          errors.push("Please provide a valid organizer email");
        }

        // Validate phone
        if (!data.eventOrganizer.phone || !data.eventOrganizer.phone.trim()) {
          errors.push("Organizer phone number is required");
        }

        // Validate institution (optional but if provided must not be empty)
        if (
          data.eventOrganizer.institution !== undefined &&
          data.eventOrganizer.institution !== null &&
          data.eventOrganizer.institution !== ""
        ) {
          if (data.eventOrganizer.institution.length > 300) {
            errors.push("Organizer institution cannot exceed 300 characters");
          }
        }
      }
    } else {
      errors.push("Event organizer is required");
    }

    // Validate dates
    if (data.startedAt) {
      if (isNaN(Date.parse(data.startedAt))) {
        errors.push("Invalid startedAt date");
      }
    }

    if (data.willEndAt) {
      if (isNaN(Date.parse(data.willEndAt))) {
        errors.push("Invalid willEndAt date");
      }
    }

    if (data.willStartAt) {
      if (isNaN(Date.parse(data.willStartAt))) {
        errors.push("Invalid willStartAt date");
      }
    }

    // Validate end time is after start time
    if (data.startedAt && data.willEndAt) {
      const start = new Date(data.startedAt);
      const end = new Date(data.willEndAt);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end <= start) {
        errors.push("End time must be after start time");
      }
    }

    if (data.willStartAt && data.willEndAt) {
      const start = new Date(data.willStartAt);
      const end = new Date(data.willEndAt);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end <= start) {
        errors.push("End time must be after start time");
      }
    }

    // Validate activity agenda if provided
    if (data.activityAgenda && Array.isArray(data.activityAgenda)) {
      for (let i = 0; i < data.activityAgenda.length; i++) {
        const phase = data.activityAgenda[i];

        // Validate fromTime
        if (
          phase.fromTime !== undefined &&
          phase.fromTime !== "" &&
          !phase.fromTime.trim()
        ) {
          errors.push(
            `Activity agenda phase ${i + 1}: from time cannot be empty`,
          );
        }

        // Validate toTime
        if (
          phase.toTime !== undefined &&
          phase.toTime !== "" &&
          !phase.toTime.trim()
        ) {
          errors.push(
            `Activity agenda phase ${i + 1}: to time cannot be empty if provided`,
          );
        }

        // Validate title
        if (
          phase.title !== undefined &&
          phase.title !== "" &&
          !phase.title.trim()
        ) {
          errors.push(
            `Activity agenda phase ${i + 1}: title cannot be empty if provided`,
          );
        }

        // Validate description
        if (
          phase.description !== undefined &&
          phase.description !== "" &&
          !phase.description.trim()
        ) {
          errors.push(
            `Activity agenda phase ${i + 1}: description cannot be empty if provided`,
          );
        }
      }
    }

    // Protect against NoSQL injection
    const dangerousChars = /[$]|\{/;
    const checkForInjection = (obj, path = "") => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        if (typeof value === "string" && dangerousChars.test(value)) {
          errors.push(`Invalid characters detected in ${currentPath}`);
        } else if (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value) &&
          !(value instanceof Date)
        ) {
          checkForInjection(value, currentPath);
        }
      }
    };
    checkForInjection(data);

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static sanitizeEventData(data) {

    if(data.agenda) {
      data.activityAgenda = data.agenda
    }
    const sanitized = {};

    // Extract only allowed fields
    const allowedFields = [
      "eventMeetingType",
      "eventName",
      "eventDescription",
      "eventType",
      "eventRoom",
      "eventFormat",
      "virtualLink",
      "virtualDescription",
      "eventOrganizer",
      "startedAt",
      "willEndAt",
      "willStartAt",
      "eventStartDate",
      "eventEndDate",
      "eventRecurring",
      "activityAgenda",
      "expectedAudience",
      "organizerEmail",
      "organizerPhone",
      "organizerInstitution",
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined && data[field] !== null) {
        if (typeof data[field] === "string") {
          sanitized[field] = data[field].trim();
        } else {
          sanitized[field] = data[field];
        }
      }
    }

    // Virtual events do not occupy a physical room; physical events carry no
    // virtual details. Only normalize when the caller explicitly sets a format,
    // so partial updates never flip or wipe an existing event's format fields.
    if (sanitized.eventFormat === "Virtual") {
      sanitized.eventRoom = "virtual";
    } else if (sanitized.eventFormat === "Physical") {
      sanitized.virtualLink = "";
      sanitized.virtualDescription = "";
    }

    // Sanitize organizer object
    if (
      sanitized.eventOrganizer &&
      typeof sanitized.eventOrganizer === "object"
    ) {
      const org = sanitized.eventOrganizer;
      sanitized.eventOrganizer = {
        fullNames: org.fullNames ? org.fullNames.trim() : "",
        email: org.email ? org.email.trim().toLowerCase() : "",
        phone: org.phone ? org.phone.trim() : "",
        institution: org.institution ? org.institution.trim() : "",
      };
    }

    // Handle backward compatibility: if old flat fields exist, construct organizer object
    if (
      !sanitized.eventOrganizer ||
      Object.keys(sanitized.eventOrganizer).length === 0
    ) {
      if (
        sanitized.organizerEmail ||
        sanitized.organizerPhone ||
        sanitized.organizerInstitution
      ) {
        const organizerName =
          sanitized.eventOrganizer?.fullNames || data.eventOrganizer || "";
        sanitized.eventOrganizer = {
          fullNames:
            typeof organizerName === "string" ? organizerName.trim() : "",
          email: sanitized.organizerEmail
            ? sanitized.organizerEmail.trim().toLowerCase()
            : "",
          phone: sanitized.organizerPhone
            ? sanitized.organizerPhone.trim()
            : "",
          institution: sanitized.organizerInstitution
            ? sanitized.organizerInstitution.trim()
            : "",
        };
        // Remove flat fields after constructing object
        delete sanitized.organizerEmail;
        delete sanitized.organizerPhone;
        delete sanitized.organizerInstitution;
      }
    }

    // Remove flat organizer fields if organizer object exists
    if (
      sanitized.eventOrganizer &&
      typeof sanitized.eventOrganizer === "object"
    ) {
      delete sanitized.organizerEmail;
      delete sanitized.organizerPhone;
      delete sanitized.organizerInstitution;
    }

    // Sanitize activity agenda
    if (sanitized.activityAgenda && Array.isArray(sanitized.activityAgenda)) {
      sanitized.activityAgenda = sanitized.activityAgenda
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

    // Convert dates
    if (sanitized.startedAt)
      sanitized.startedAt = new Date(sanitized.startedAt);
    if (sanitized.willEndAt)
      sanitized.willEndAt = new Date(sanitized.willEndAt);
    if (sanitized.willStartAt)
      sanitized.willStartAt = new Date(sanitized.willStartAt);
    if (sanitized.eventStartDate)
      sanitized.eventStartDate = new Date(sanitized.eventStartDate);
    if (sanitized.eventEndDate)
      sanitized.eventEndDate = new Date(sanitized.eventEndDate);
    console.log(sanitized)
    return sanitized;

  
  }
}

module.exports = EventValidator;
