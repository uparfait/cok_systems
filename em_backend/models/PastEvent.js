const mongoose = require("mongoose");

const pastEventSchema = new mongoose.Schema(
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
    eventFormat: {
      type: String,
      enum: {
        values: ["Physical", "Virtual"],
        message: "Event format must be either Physical or Virtual",
      },
      default: "Physical",
    },
    virtualLink: {
      type: String,
      trim: true,
      maxlength: [1000, "Virtual link cannot exceed 1000 characters"],
      default: "",
    },
    virtualDescription: {
      type: String,
      trim: true,
      maxlength: [1000, "Virtual description cannot exceed 1000 characters"],
      default: "",
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
    startedAt: {
      type: Date,
      required: [true, "Start time is required"],
    },
    expectedToEndAt: {
      type: Date,
      required: [true, "Expected end time is required"],
    },
    endedAt: {
      type: Date,
      required: [true, "Actual end time is required"],
    },
    isCancelled: {
      type: Boolean,
      default: false,
    },
    cancellationReason: {
      type: String,
      maxlength: [1000, "Cancellation reason cannot exceed 1000 characters"],
      trim: true,
      default: "",
    },
    activityAgenda: [
      {
        fromTime: {
          type: String,
          validate: {
            validator: function (value) {
              return !value || value.trim().length > 0;
            },
            message: "From time cannot be empty if provided",
          },
        },
        toTime: {
          type: String,
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
        presenter: {
          name: { type: String, trim: true, default: "" },
          email: { type: String, trim: true, default: "" },
          role: { type: String, trim: true, default: "" },
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
    validateBeforeSave: true,
  },
);

pastEventSchema.index({ startedAt: 1 });
pastEventSchema.index({ endedAt: 1 });
pastEventSchema.index({ eventType: 1 });
pastEventSchema.index({ eventRoom: 1 });
pastEventSchema.index({ isCancelled: 1 });

const PastEvent = mongoose.model("PastEvent", pastEventSchema);

module.exports = PastEvent;