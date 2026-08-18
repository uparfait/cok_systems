const mongoose = require("mongoose");
const recurringSubSchema = require("./schemas/RecurringSubSchema");

const recurringEventSchema = new mongoose.Schema(
  {
    eventMeetingType: {
      type: String,
      enum: {
        values: ["event", "meet"],
        message: "Event meeting type must be either event or meet",
      },
      default: "event",
    },
    eventName: {
      type: String,
      required: [true, "Event name is required"],
      maxlength: [500, "Event name cannot exceed 500 characters"],
      trim: true,
    },
    eventDescription: {
      type: String,
      required: [true, "Event description is required"],
      maxlength: [2000, "Event description cannot exceed 2000 characters"],
      trim: true,
    },
    eventType: {
      type: String,
      required: [true, "Event type is required"],
      enum: {
        values: ["Internal", "Joint", "External"],
        message: "Event type must be either Internal, Joint or External",
      },
    },
    eventRoom: {
      type: String,
      required: [true, "Room name is required"],
      maxlength: [300, "Room name cannot exceed 300 characters"],
      trim: true,
      set: (value) => value.toLowerCase(),
    },
    eventOrganizer: {
      fullNames: {
        type: String,
        required: [true, "Organizer full names are required"],
        maxlength: [200, "Full names cannot exceed 200 characters"],
        trim: true,
      },
      email: {
        type: String,
        required: [true, "Organizer email is required"],
        maxlength: [300, "Email cannot exceed 300 characters"],
        trim: true,
        lowercase: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please provide a valid email"],
      },
      phone: {
        type: String,
        required: [true, "Organizer phone number is required"],
        trim: true,
      },
      institution: {
        type: String,
        maxlength: [300, "Institution name cannot exceed 300 characters"],
        trim: true,
        default: "",
      },
    },
    coOrganizers: [
      {
        fullNames: { type: String, trim: true, maxlength: 200 },
        email: { type: String, trim: true, lowercase: true },
        phone: { type: String, trim: true },
        institution: { type: String, trim: true, default: "" },
      },
    ],
    eventSpecialId: {
      type: String,
      required: [true, "Event special ID is required"],
      unique: true,
    },
    eventRecurring: {
      type: recurringSubSchema,
      required: [true, "Recurring configuration is required"],
      validate: {
        validator: function (value) {
          if (!value.isRecurring) {
            throw new Error(
              "Recurring events must have isRecurring set to true",
            );
          }
          return true;
        },
      },
    },
    activityAgenda: [
      {
        
        fromTime: {
          type: String, // "09:00 AM"
          validate: {
            validator: function (value) {
              return !value || value.trim().length > 0;
            },
            message: "From time cannot be empty if provided",
          },
        },
        toTime: {
          type: String, //  "10:00 AM"
          validate: {
            validator: function (value) {
              return !value || value.trim().length > 0;
            },
            message: "To time cannot be empty if provided",
          },
        },
        title: {
          type: String,
          validate: {
            validator: function (value) {
              return !value || value.trim().length > 0;
            },
            message: "Title cannot be empty if provided",
          },
        },
        description: {
          type: String,
          validate: {
            validator: function (value) {
              return !value || value.trim().length > 0;
            },
            message: "Description cannot be empty if provided",
          },
        },
      },
    ],
    expectedAudience: {
      type: Number,
      min: [1, "Expected audience must be at least 1"],
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for querying
recurringEventSchema.index({ "eventRecurring.recurringEndDate": 1 });
recurringEventSchema.index({ "eventRecurring.eventStartTime": 1 });
recurringEventSchema.index({ "eventRecurring.eventEndTime": 1 });
recurringEventSchema.index({ eventRoom: 1 });
recurringEventSchema.index({ eventOrganizer: 1 });
recurringEventSchema.index({ eventType: 1 });

const RecurringEvent = mongoose.model("RecurringEvent", recurringEventSchema);

module.exports = RecurringEvent;
