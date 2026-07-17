const uuid = require("uuid");
const withTransaction = require("../utilities/withTransaction");
const BookingRequest = require("../models/BookingRequest");
const Room = require("../models/Room");
const CheckRoomAvailability = require("../utilities/CheckRoomAvailability");
const BookingRequestValidator = require("../validators/BookingRequestValidator");
const EventService = require("./EventService");
const emailUtil = require("../utilities/email");
const config = require("../configurations/config");

class BookingRequestService {
  /**
   * Direct link the organizer can use to track / edit / cancel their request.
   */
  static _buildTrackUrl(trackingCode) {
    return `${config.frontendUrl}/book-a-room/track?code=${encodeURIComponent(trackingCode)}`;
  }

  /**
   * Human-readable date/time in the City of Kigali timezone for emails.
   */
  static _formatWindow(date) {
    if (!date) return "";
    return new Date(date).toLocaleString("en-US", {
      timeZone: "Africa/Kigali",
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  static async generateTrackingCode() {
    let trackingCode;
    let isUnique = false;

    while (!isUnique) {
      trackingCode = `BRK-${uuid.v4().slice(0, 8).toUpperCase()}`;
      const existing = await BookingRequest.findOne({ trackingCode });
      if (!existing) {
        isUnique = true;
      }
    }

    return trackingCode;
  }

  static async createRequest(data) {
    // Validate input
    const validation = BookingRequestValidator.validateCreate(data);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(", "));
    }

    const sanitizedData = BookingRequestValidator.sanitizeCreate(data);

    // Verify room exists and is active
    const room = await Room.findOne({
      roomName: sanitizedData.eventRoom.toLowerCase(),
      isActive: true,
    }).lean();

    if (!room) {
      throw new Error("Room not found or is inactive");
    }

    // Check room capacity
    if (sanitizedData.expectedAudience && sanitizedData.expectedAudience > room.roomCapacity) {
      throw new Error(
        `Expected audience (${sanitizedData.expectedAudience}) exceeds room capacity (${room.roomCapacity})`
      );
    }

    // Check for double-booking conflicts:
    // 1. Against Live/Upcoming events
    const eventConflict = await CheckRoomAvailability.execute(
      sanitizedData.eventRoom,
      sanitizedData.startTime,
      sanitizedData.endTime
    );

    if (!eventConflict.available) {
      throw new Error(
        "Room is not available during the requested time. There is a conflict with an existing event."
      );
    }

    // 2. Against existing Pending or Accepted booking requests for the same room/time
    const requestConflict = await BookingRequest.findOne({
      eventRoom: sanitizedData.eventRoom,
      status: { $in: ["Pending", "Accepted"] },
      $or: [
        { startTime: { $lt: sanitizedData.endTime }, endTime: { $gt: sanitizedData.startTime } },
      ],
    }).lean();

    if (requestConflict) {
      throw new Error(
        "Room is already requested for the same time period. Another booking request exists."
      );
    }

    // Generate tracking code
    const trackingCode = await this.generateTrackingCode();

    // Create booking request
    const bookingRequest = new BookingRequest({
      ...sanitizedData,
      trackingCode,
      status: "Pending",
    });

    await bookingRequest.save();

    // Notify the organizer (if an email is provided) with the tracking code and link
    try {
      const organizerEmail = bookingRequest.eventOrganizer?.email;
      if (organizerEmail) {
        await emailUtil.sendBookingSubmittedEmail(organizerEmail, {
          trackingCode: bookingRequest.trackingCode,
          trackUrl: this._buildTrackUrl(bookingRequest.trackingCode),
          eventName: bookingRequest.eventName,
          eventRoom: bookingRequest.eventRoom,
          start: this._formatWindow(bookingRequest.startTime),
          end: this._formatWindow(bookingRequest.endTime),
        });
      }
    } catch (emailError) {
      console.error("Failed to send booking submission email:", emailError.message);
    }

    return {
      success: true,
      message: "Booking request submitted successfully",
      data: bookingRequest,
    };
  }

  static async acceptRequest(requestId) {
    let notifyEmail = null;
    let notifyData = null;

    const result = await withTransaction(async (session) => {
      const request = await BookingRequest.findById(requestId).session(session);
      if (!request) {
        throw new Error("Booking request not found");
      }

      if (request.status !== "Pending") {
        throw new Error(`Cannot accept a request with status: ${request.status}`);
      }

      // Create the actual event based on the request data
      const eventData = {
        eventMeetingType: request.eventMeetingType || "event",
        eventName: request.eventName,
        eventDescription: request.eventDescription,
        eventType: request.eventType,
        eventRoom: request.eventRoom,
        eventOrganizer: request.eventOrganizer,
        expectedAudience: request.expectedAudience,
        activityAgenda: request.activityAgenda || [],
      };

      const startTime = new Date(request.startTime);
      const endTime = new Date(request.endTime);

      let acceptedEventSpecialId;

      // Create as upcoming event
      eventData.willStartAt = startTime;
      eventData.willEndAt = endTime;

      // Use EventService to create the event
      // Delegate to EventService which handles all validation
      eventData.eventMode = "upcoming";

      const result = await EventService.createEvent(eventData, requestId);

      acceptedEventSpecialId = result.data.eventSpecialId;

      // Update booking request
      request.status = "Accepted";
      request.acceptedEventSpecialId = acceptedEventSpecialId;
      request.acceptedEventType = "upcoming";
      await request.save({ session });

      notifyEmail = request.eventOrganizer?.email || null;
      notifyData = {
        trackingCode: request.trackingCode,
        trackUrl: this._buildTrackUrl(request.trackingCode),
        eventName: request.eventName,
        eventRoom: request.eventRoom,
        start: this._formatWindow(request.startTime),
        end: this._formatWindow(request.endTime),
      };

      return {
        success: true,
        message: "Booking request accepted and event created successfully",
        data: {
          bookingRequest: request,
          event: result.data,
        },
      };
    });

    // Notify the organizer (if an email is provided) after the transaction commits
    if (notifyEmail) {
      try {
        await emailUtil.sendBookingAcceptedEmail(notifyEmail, notifyData);
      } catch (emailError) {
        console.error("Failed to send booking acceptance email:", emailError.message);
      }
    }

    return result;
  }

  static async rejectRequest(requestId, reason) {
    let notifyEmail = null;
    let notifyData = null;

    const result = await withTransaction(async (session) => {
      const request = await BookingRequest.findById(requestId).session(session);
      if (!request) {
        throw new Error("Booking request not found");
      }

      if (request.status !== "Pending") {
        throw new Error(`Cannot reject a request with status: ${request.status}`);
      }

      // Validate rejection reason
      const validation = BookingRequestValidator.validateReject({ reason });
      if (!validation.isValid) {
        throw new Error(validation.errors.join(", "));
      }

      request.status = "Rejected";
      request.rejectionReason = reason.trim();
      await request.save({ session });

      notifyEmail = request.eventOrganizer?.email || null;
      notifyData = {
        trackingCode: request.trackingCode,
        trackUrl: this._buildTrackUrl(request.trackingCode),
        eventName: request.eventName,
        eventRoom: request.eventRoom,
        reason: reason.trim(),
      };

      return {
        success: true,
        message: "Booking request rejected",
        data: request,
      };
    });

    // Notify the organizer (if an email is provided) after the transaction commits
    if (notifyEmail) {
      try {
        await emailUtil.sendBookingRejectedEmail(notifyEmail, notifyData);
      } catch (emailError) {
        console.error("Failed to send booking rejection email:", emailError.message);
      }
    }

    return result;
  }

  static async cancelRequest(requestId) {
    const request = await BookingRequest.findById(requestId);
    if (!request) {
      throw new Error("Booking request not found");
    }

    if (request.status !== "Pending") {
      throw new Error(
        `Cannot cancel a request with status: ${request.status}. Only pending requests can be cancelled.`
      );
    }

    request.status = "Cancelled";
    await request.save();

    return {
      success: true,
      message: "Booking request cancelled",
      data: request,
    };
  }

  static async getByTrackingCode(trackingCode) {
    const request = await BookingRequest.findOne({
      trackingCode: trackingCode.replace(/^#/, '').trim().toUpperCase(),
    }).lean();

    if (!request) {
      throw new Error("Booking request not found with the provided tracking code");
    }

    return {
      success: true,
      data: request,
    };
  }

  static async getById(requestId) {
    const request = await BookingRequest.findById(requestId).lean();
    if (!request) {
      throw new Error("Booking request not found");
    }

    return {
      success: true,
      data: request,
    };
  }

  static async listRequests(query = {}) {
    const {
      page = 1,
      limit = 20,
      status,
      startDate,
      endDate,
      sort = "new",
    } = query;

    const queryObject = {};

    // Filter by status
    if (status && ["Pending", "Accepted", "Rejected", "Cancelled"].includes(status)) {
      queryObject.status = status;
    }

    // Filter by date range
    if (startDate || endDate) {
      queryObject.createdAt = {};
      if (startDate) {
        queryObject.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        queryObject.createdAt.$lte = new Date(endDate);
      }
    }

    // Build sort object
    const sortObject = {};
    if (sort === "old") {
      sortObject.createdAt = 1;
    } else {
      sortObject.createdAt = -1;
    }

    const totalRecords = await BookingRequest.countDocuments(queryObject);
    const totalPages = Math.ceil(totalRecords / limit);

    const data = await BookingRequest.find(queryObject)
      .sort(sortObject)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return {
      success: true,
      totalRecords,
      totalPages,
      currentPage: parseInt(page),
      data,
    };
  }

  static async updateRequest(requestId, updateData) {
    const request = await BookingRequest.findById(requestId);
    if (!request) {
      throw new Error("Booking request not found");
    }

    if (request.status !== "Pending") {
      throw new Error(
        `Cannot edit a request with status: ${request.status}. Only pending requests can be edited.`
      );
    }

    const validation = BookingRequestValidator.validateUpdate(updateData);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(", "));
    }

    // Build update fields
    const allowedUpdates = [
      "eventName",
      "eventDescription",
      "eventType",
      "eventRoom",
      "eventMeetingType",
      "expectedAudience",
      "activityAgenda",
    ];

    for (const field of allowedUpdates) {
      if (updateData[field] !== undefined) {
        if (typeof updateData[field] === "string") {
          request[field] = updateData[field].trim();
        } else {
          request[field] = updateData[field];
        }
      }
    }

    // Handle organizer update
    if (updateData.eventOrganizer && typeof updateData.eventOrganizer === "object") {
      if (updateData.eventOrganizer.fullNames) {
        request.eventOrganizer.fullNames = updateData.eventOrganizer.fullNames.trim();
      }
      if (updateData.eventOrganizer.email) {
        request.eventOrganizer.email = updateData.eventOrganizer.email.trim().toLowerCase();
      }
      if (updateData.eventOrganizer.phone) {
        request.eventOrganizer.phone = updateData.eventOrganizer.phone.trim();
      }
      if (updateData.eventOrganizer.institution !== undefined) {
        request.eventOrganizer.institution = updateData.eventOrganizer.institution.trim();
      }
    }

    // Handle schedule update
    if (updateData.startTime || updateData.endTime) {
      const newStart = updateData.startTime
        ? new Date(updateData.startTime)
        : request.startTime;
      const newEnd = updateData.endTime
        ? new Date(updateData.endTime)
        : request.endTime;

      if (newEnd <= newStart) {
        throw new Error("End time must be after start time");
      }

      // Re-check room availability if schedule changed
      if (updateData.startTime || updateData.endTime) {
        const roomToCheck = updateData.eventRoom || request.eventRoom;

        // Check events
        const eventConflict = await CheckRoomAvailability.execute(
          roomToCheck.toLowerCase(),
          newStart,
          newEnd,
          null,
          null,
          requestId
        );
        if (!eventConflict.available) {
          throw new Error(
            "Room is not available during the updated time. There is a conflict with an existing event."
          );
        }

        // Check other booking requests
        const requestConflict = await BookingRequest.findOne({
          _id: { $ne: requestId },
          eventRoom: roomToCheck.toLowerCase(),
          status: { $in: ["Pending", "Accepted"] },
          $or: [
            { startTime: { $lt: newEnd }, endTime: { $gt: newStart } },
          ],
        }).lean();

        if (requestConflict) {
          throw new Error(
            "Room is already requested for the updated time period by another booking request."
          );
        }

        request.startTime = newStart;
        request.endTime = newEnd;
      }
    }

    // Handle room change
    if (updateData.eventRoom && updateData.eventRoom !== request.eventRoom) {
      const newRoom = updateData.eventRoom.toLowerCase();
      const room = await Room.findOne({ roomName: newRoom, isActive: true }).lean();
      if (!room) {
        throw new Error("New room not found or is inactive");
      }
      request.eventRoom = newRoom;
    }

    await request.save();

    return {
      success: true,
      message: "Booking request updated successfully",
      data: request,
    };
  }
}

module.exports = BookingRequestService;