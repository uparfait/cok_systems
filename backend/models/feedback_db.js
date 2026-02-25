// feedback_db model

const mongoose = require("mongoose");
const { Schema } = mongoose;

const feedbackSchema = new Schema({
    user_name: String,
    telephone: String,
    textmessage: String,
    rate: Number,
    rate_out_of: Number,
    created_date: { type: Date, default: Date.now },
    department_name: String,
    department_id: String,
    provider_name: String,
});

const Feedback = mongoose.model("feedback_db", feedbackSchema);

module.exports = Feedback;