// un serviced feedback model

const mongoose = require("mongoose");
const { Schema } = mongoose;


const unservicedfeedbackSchema = new Schema({
    user_name: String,
    telephone: String,
    textmessage: String,
    rate: Number,
    rate_out_of: Number,
    created_date: { type: Date, default: Date.now },
},
{
    versionKey: false, // removes __v automatically
    toJSON: {
        transform: function (doc, ret) {
            delete ret.__v; // just in case
            return ret;
        }
    },
    toObject: {
        transform: function (doc, ret) {
            delete ret.__v;
            return ret;
        }
    }
});

/* Unique compound index to ensure one feedback per phone number per department
unservicedfeedbackSchema.index({ telephone:

const UnservicedFeedback = mongoose.model("unservicedfeedback_db", unservicedfeedbackSchema);

module.exports = UnservicedFeedback;*/