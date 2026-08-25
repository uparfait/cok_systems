const withTransaction = require('../utilities/withTransaction');
const LiveEvent = require('../models/LiveEvent');
const UpcomingEvent = require('../models/UpcomingEvent');
const RecurringEvent = require('../models/RecurringEvent');
const PastEvent = require('../models/PastEvent');
const Room = require('../models/Room');
const GenerateUniqueEventSpecialId = require('../utilities/GenerateUniqueEventSpecialId');
const CheckRoomAvailability = require('../utilities/CheckRoomAvailability');
const EventValidator = require('../validators/EventValidator');
const RecurringValidator = require('../validators/RecurringValidator');
const CalculateMonthlyFirstOccurrence = require('./CalculateMonthlyFirstOccurrence');
const mongoose = require("mongoose");

class EventService {
  static async createEvent(eventData, requestId = null) {
    return withTransaction(async (session) => {
      // Validate and sanitize input
      const validation = EventValidator.validateEventData(eventData);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(", "));
      }

      const sanitizedData = EventValidator.sanitizeEventData(eventData);

      // Set default eventMeetingType if not provided
      if (!sanitizedData.eventMeetingType) {
        sanitizedData.eventMeetingType = eventData.eventMeetingType || "event";
      }

      // Generate unique ID
      sanitizedData.eventSpecialId =
        await GenerateUniqueEventSpecialId.execute();

      if (!sanitizedData.eventFormat) {
        sanitizedData.eventFormat = "Physical";
      }

      // Verify room exists (virtual events do not occupy a physical room)
      if (sanitizedData.eventFormat !== "Virtual") {
        const room = await Room.findOne({
          roomName: sanitizedData.eventRoom.toLowerCase(),
          isActive: true,
        }).session(session);

        if (!room) {
          throw new Error("Room not found or is inactive");
        }
      }

      let event;
      const eventMode = eventData.eventMode;

      switch (eventMode) {
        case "live":
          event = await this.createLiveEvent(sanitizedData, session);
          break;
        case "upcoming":
          event = await this.createUpcomingEvent(
            sanitizedData,
            session,
            requestId,
          );
          break;
        case "recurring":
          event = await this.createRecurringEvent(sanitizedData, session);
          break;
        default:
          throw new Error("Invalid event mode");
      }

      return { success: true, data: event };
    });
  }

  static async createLiveEvent(data, session) {
    const { startedAt, willEndAt } = data;
    const now = new Date();

    if (!startedAt || !willEndAt) {
      throw new Error("Live events require startedAt and willEndAt");
    }

    if (new Date(startedAt) >= new Date(willEndAt)) {
      throw new Error("End time must be after start time");
    }

    // A "live" event whose start time is still in the future is actually an
    // upcoming event — respect the dates over the selected mode.
    if (new Date(startedAt) > now) {
      return await this.createUpcomingEvent(
        {
          ...data,
          willStartAt: new Date(startedAt),
          willEndAt: new Date(willEndAt),
        },
        session,
      );
    }

    // Check room availability (exclude self by eventSpecialId)
    if (data.eventFormat !== "Virtual") {
      const availability = await CheckRoomAvailability.execute(
        data.eventRoom,
        new Date(startedAt),
        new Date(willEndAt),
        data.eventSpecialId || null,
      );

      if (!availability.available) {
        throw new Error(
          `Selected room is already reserved during the requested time by a ${availability.conflict} event which is ${availability.details.eventName}`,
        );
      }
    }

    // If event ends in the past, create as past event
    if (new Date(willEndAt) <= now) {
      return await this.createPastEvent(
        {
          ...data,
          startedAt: new Date(startedAt),
          expectedToEndAt: new Date(willEndAt),
          endedAt: new Date(willEndAt),
        },
        session,
      );
    }

    const liveEvent = new LiveEvent({
      ...data,
      startedAt: new Date(startedAt),
      willEndAt: new Date(willEndAt),
    });

    return await liveEvent.save({ session });
  }

  static async createUpcomingEvent(data, session, requestId = null) {
    const { willStartAt, willEndAt } = data;
    const now = new Date();

    if (!willStartAt || !willEndAt) {
      throw new Error("Upcoming events require willStartAt and willEndAt");
    }

    if (new Date(willStartAt) >= new Date(willEndAt)) {
      throw new Error("End time must be after start time");
    }

    // Check room availability (exclude self by eventSpecialId)
    if (data.eventFormat !== "Virtual") {
      const availability = await CheckRoomAvailability.execute(
        data.eventRoom,
        new Date(willStartAt),
        new Date(willEndAt),
        data.eventSpecialId || null,
        null,
        requestId || null,
      );

      if (!availability.available) {
        throw new Error(
          `Selected room is already reserved during the requested time by a ${availability.conflict} event which is ${availability.details.eventName}`,
        );
      }
    }

    // If event would have ended in the past, create as past event
    if (new Date(willEndAt) <= now) {
      return await this.createPastEvent(
        {
          ...data,
          startedAt: new Date(willStartAt),
          expectedToEndAt: new Date(willEndAt),
          endedAt: new Date(willEndAt),
        },
        session,
      );
    }

    // An "upcoming" event whose start time has already passed (but has not
    // ended yet) is actually live — respect the dates over the selected mode.
    if (new Date(willStartAt) <= now) {
      const liveEvent = new LiveEvent({
        ...data,
        startedAt: new Date(willStartAt),
        willEndAt: new Date(willEndAt),
      });
      return await liveEvent.save({ session });
    }

    const upcomingEvent = new UpcomingEvent({
      ...data,
      willStartAt: new Date(willStartAt),
      willEndAt: new Date(willEndAt),
    });

    return await upcomingEvent.save({ session });
  }

  static async createRecurringEvent(data, session) {
    // Validate recurring data
    const validation = RecurringValidator.validate(data);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(", "));
    }

    const { eventRecurring } = data;

    // Check if recurrence has expired
    if (new Date(eventRecurring.recurringEndDate) < new Date()) {
      throw new Error("Recurring end date has already passed");
    }

    // Validate recurring configuration based on type
    this.validateRecurringConfiguration(eventRecurring);

    // For room availability, we need to check the first occurrence
    // (virtual events do not occupy a physical room)
    if (data.eventFormat !== "Virtual") {
      const firstOccurrenceDate = this.calculateFirstOccurrence(eventRecurring);

      // Check room availability - exclude self by eventSpecialId
      // The eventSpecialId is already generated in createEvent prior to this call
      const availability = await CheckRoomAvailability.execute(
        data.eventRoom,
        firstOccurrenceDate.startDateTime,
        firstOccurrenceDate.endDateTime,
        data.eventSpecialId || null,
      );

      if (!availability.available) {
        throw new Error(
          `Selected room is already reserved during the requested time by a ${availability.conflict} event which is ${availability.details.eventName}`,
        );
      }
    }

    const recurringEvent = new RecurringEvent(data);
    return await recurringEvent.save({ session });
  }

  static validateRecurringConfiguration(recurringConfig) {
    const {
      recurringType,
      weeklyDays,
      monthlyDates,
      monthlyPattern,
      eventStartTime,
      eventEndTime,
    } = recurringConfig;

    if (!eventStartTime || !eventEndTime) {
      throw new Error(
        "Event start time and end time are required for recurring events",
      );
    }

    // Validate time format and logic
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(eventStartTime) || !timeRegex.test(eventEndTime)) {
      throw new Error("Time must be in HH:MM format (00:00-23:59)");
    }

    if (eventStartTime >= eventEndTime) {
      throw new Error("Event end time must be after start time");
    }

    // Type-specific validations
    switch (recurringType) {
      case "Daily":
        break;

      case "Weekly":
        if (!weeklyDays || weeklyDays.length === 0) {
          throw new Error(
            "Weekly recurring events must specify at least one day",
          );
        }
        if (!weeklyDays.every((day) => day >= 0 && day <= 6)) {
          throw new Error(
            "Weekly days must be between 0 (Sunday) and 6 (Saturday)",
          );
        }
        break;

      case "Monthly":
        if (monthlyPattern === "specific" || monthlyPattern === "mixed") {
          if (!monthlyDates || monthlyDates.length === 0) {
            throw new Error(
              "Monthly recurring events with specific/mixed pattern must specify dates",
            );
          }
          if (!monthlyDates.every((date) => date >= 1 && date <= 31)) {
            throw new Error("Monthly dates must be between 1 and 31");
          }
        }
        break;

      default:
        throw new Error("Invalid recurring type");
    }
  }

  static calculateFirstOccurrence(recurringConfig) {
    const now = new Date();
    const {
      recurringType,
      eventStartTime,
      eventEndTime,
      weeklyDays,
      monthlyDates,
      monthlyPattern,
    } = recurringConfig;

    const [startHours, startMinutes] = eventStartTime.split(":").map(Number);
    const [endHours, endMinutes] = eventEndTime.split(":").map(Number);

    let startDateTime, endDateTime;

    switch (recurringType) {
      case "Daily":
        startDateTime = new Date(now);
        startDateTime.setHours(startHours, startMinutes, 0, 0);

        if (startDateTime <= now) {
          startDateTime.setDate(startDateTime.getDate() + 1);
        }

        endDateTime = new Date(startDateTime);
        endDateTime.setHours(endHours, endMinutes, 0, 0);
        break;

      case "Weekly": {
        const currentDay = now.getDay();
        const sortedDays = [...weeklyDays].sort((a, b) => a - b);

        let nextDay = sortedDays.find((day) => day > currentDay);
        if (nextDay === undefined) {
          nextDay = sortedDays[0];
        }

        const daysUntilNext =
          nextDay > currentDay
            ? nextDay - currentDay
            : 7 - currentDay + nextDay;

        startDateTime = new Date(now);
        startDateTime.setDate(startDateTime.getDate() + daysUntilNext);
        startDateTime.setHours(startHours, startMinutes, 0, 0);

        endDateTime = new Date(startDateTime);
        endDateTime.setHours(endHours, endMinutes, 0, 0);
        break;
      }

      case "Monthly":
        startDateTime = this.calculateMonthlyFirstOccurrence(
          now,
          monthlyPattern,
          monthlyDates,
          startHours,
          startMinutes,
        );
        endDateTime = new Date(startDateTime);
        endDateTime.setHours(endHours, endMinutes, 0, 0);
        break;

      default:
        throw new Error("Invalid recurring type for occurrence calculation");
    }

    return { startDateTime, endDateTime };
  }

  static calculateMonthlyFirstOccurrence(
    now,
    monthlyPattern,
    monthlyDates,
    startHours,
    startMinutes,
  ) {
    return CalculateMonthlyFirstOccurrence(
      now,
      monthlyPattern,
      monthlyDates,
      startHours,
      startMinutes,
    );
  }

  static async createPastEvent(data, session) {
    const pastEvent = new PastEvent(data);
    return await pastEvent.save({ session });
  }

  static async moveUpcomingToLive(eventId, session) {
    const upcomingEvent =
      await UpcomingEvent.findById(eventId).session(session);
    if (!upcomingEvent) {
      throw new Error("Upcoming event not found");
    }

    const liveEventData = {
      eventMeetingType: upcomingEvent.eventMeetingType || "event",
      eventName: upcomingEvent.eventName,
      eventDescription: upcomingEvent.eventDescription,
      eventType: upcomingEvent.eventType,
      eventRoom: upcomingEvent.eventRoom,
      eventFormat: upcomingEvent.eventFormat || "Physical",
      virtualLink: upcomingEvent.virtualLink || "",
      virtualDescription: upcomingEvent.virtualDescription || "",
      eventOrganizer: upcomingEvent.eventOrganizer,
      coOrganizers: upcomingEvent.coOrganizers || [],
      eventSpecialId: upcomingEvent.eventSpecialId,
      startedAt: upcomingEvent.willStartAt,
      willEndAt: upcomingEvent.willEndAt,
      expectedAudience: upcomingEvent.expectedAudience,
      activityAgenda: upcomingEvent.activityAgenda || [],
    };

    const liveEvent = new LiveEvent(liveEventData);
    await liveEvent.save({ session });
    await UpcomingEvent.findByIdAndDelete(eventId, { session });

    return liveEvent;
  }

  static async moveLiveToPast(eventId, session) {
    const liveEvent = await LiveEvent.findById(eventId).session(session);
    if (!liveEvent) {
      throw new Error("Live event not found");
    }

    const pastEventData = {
      eventMeetingType: liveEvent.eventMeetingType || "event",
      eventName: liveEvent.eventName,
      eventDescription: liveEvent.eventDescription,
      eventType: liveEvent.eventType,
      eventRoom: liveEvent.eventRoom,
      eventFormat: liveEvent.eventFormat || "Physical",
      virtualLink: liveEvent.virtualLink || "",
      virtualDescription: liveEvent.virtualDescription || "",
      eventOrganizer: liveEvent.eventOrganizer,
      coOrganizers: liveEvent.coOrganizers || [],
      eventSpecialId: `${liveEvent.eventSpecialId}__${Date.now()}`,
      startedAt: liveEvent.startedAt,
      expectedToEndAt: liveEvent.willEndAt,
      endedAt: new Date(),
      expectedAudience: liveEvent.expectedAudience,
      activityAgenda: liveEvent.activityAgenda || [],
    };

    const pastEvent = new PastEvent(pastEventData);
    await pastEvent.save({ session });
    await LiveEvent.findByIdAndDelete(eventId, { session });

    return pastEvent;
  }

  static async getEvents(Model, query = {}) {
    const {
      page = 1,
      limit = 20,
      sort = "new",
      filter,
      search,
      searchField,
      excludeVirtual,
    } = query;

    const queryObject = {};

    // Public listings hide virtual events entirely
    if (excludeVirtual === "true" || excludeVirtual === true) {
      queryObject.eventFormat = { $ne: "Virtual" };
    }

    if (search && searchField) {
      if (searchField === "eventSpecialId") {
        const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        const normalizedSearch = escapeRegex(search.toLowerCase().trim());

        queryObject.eventSpecialId = {
          $regex: `^${normalizedSearch}$`,
          $options: "i",
        };
      } else {
        queryObject[searchField] = {
          $regex: search,
          $options: "i",
        };
      }
    } else if (search && String(search).trim()) {
      // No searchField: search across ALL event attributes
      const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = { $regex: escapeRegex(String(search).trim()), $options: "i" };
      const orConditions = [
        { eventName: rx },
        { eventDescription: rx },
        { eventType: rx },
        { eventMeetingType: rx },
        { eventRoom: rx },
        { eventSpecialId: rx },
        { "eventOrganizer.fullNames": rx },
        { "eventOrganizer.email": rx },
        { "eventOrganizer.phone": rx },
        { "eventOrganizer.institution": rx },
        { "eventRecurring.recurringType": rx },
        { cancellationReason: rx },
        { "activityAgenda.title": rx },
        { "activityAgenda.description": rx },
      ];
      const numeric = Number(String(search).trim());
      if (!isNaN(numeric)) {
        orConditions.push({ expectedAudience: numeric });
      }
      queryObject.$or = orConditions;
    }

    if (filter) {
      const now = new Date();
      switch (filter) {
        case "thisWeek": {
          const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
          const weekEnd = new Date(
            now.setDate(now.getDate() - now.getDay() + 7),
          );
          queryObject.createdAt = { $gte: weekStart, $lte: weekEnd };
          break;
        }
        case "thisMonth": {
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          queryObject.createdAt = { $gte: monthStart, $lte: monthEnd };
          break;
        }
        case "thisYear": {
          const yearStart = new Date(now.getFullYear(), 0, 1);
          const yearEnd = new Date(now.getFullYear(), 11, 31);
          queryObject.createdAt = { $gte: yearStart, $lte: yearEnd };
          break;
        }

        case "External": {
          queryObject.eventType = "External";
          break;
        }
        case "Internal": {
          queryObject.eventType = "Internal";
          break;
        }
        case "Joint": {
          queryObject.eventType = "Joint";
          break;
        }
      }
    }

    const sortObject = {};
    if (sort === "old") {
      sortObject.createdAt = 1;
    } else {
      sortObject.createdAt = -1;
    }

    const totalRecords = await Model.countDocuments(queryObject);
    const totalPages = Math.ceil(totalRecords / limit);

    const data = await Model.find(queryObject)
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
}

module.exports = EventService;
