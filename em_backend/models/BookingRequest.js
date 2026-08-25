const mongoose = require("mongoose");

const bookingRequestSchema = new mongoose.Schema(
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
    startTime: {
      type: Date,
      required: [true, "Start time is required"],
    },
    endTime: {
      type: Date,
      required: [true, "End time is required"],
      validate: {
        validator: function (value) {
          return value > this.startTime;
        },
        message: "End time must be after start time",
      },
    },
    expectedAudience: {
      type: Number,
      min: [1, "Expected audience must be at least 1"],
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
      },
    ],
    trackingCode: {
      type: String,
      required: [true, "Tracking code is required"],
    },
    status: {
      type: String,
      enum: {
        values: ["Pending", "Accepted", "Rejected", "Cancelled"],
        message: "Status must be Pending, Accepted, Rejected or Cancelled",
      },
      default: "Pending",
    },
    rejectionReason: {
      type: String,
      maxlength: [1000, "Rejection reason cannot exceed 1000 characters"],
      trim: true,
      default: "",
    },
    acceptedEventSpecialId: {
      type: String,
      default: null,
    },
    acceptedEventType: {
      type: String,
      enum: {
        values: ["upcoming", "recurring"],
        message: "Accepted event type must be upcoming or recurring",
      },
      default: null,
    },
    // Water request made by the organizer from the tracking page — only
    // allowed after the request is Accepted and only for Internal type
    waterRequest: {
      requested: { type: Boolean, default: false },
      requestedAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  }
);

bookingRequestSchema.index({ trackingCode: 1 });
bookingRequestSchema.index({ status: 1 });
bookingRequestSchema.index({ startTime: 1, endTime: 1 });
bookingRequestSchema.index({ eventRoom: 1, status: 1 });
bookingRequestSchema.index({ "eventOrganizer.email": 1 });

const BookingRequest = mongoose.model("BookingRequest", bookingRequestSchema);

module.exports = BookingRequest;