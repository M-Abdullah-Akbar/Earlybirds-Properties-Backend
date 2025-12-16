const mongoose = require("mongoose");

const JobApplicationSchema = new mongoose.Schema({
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Job",
        required: true,
    },
    name: {
        type: String,
        required: [true, "Please add a name"],
        trim: true,
    },
    email: {
        type: String,
        required: [true, "Please add an email"],
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            "Please add a valid email",
        ],
    },
    phone: {
        type: String,
        required: [true, "Please add a phone number"],
    },
    cvPath: {
        type: String,
        required: [true, "Please upload a CV"],
    },
    message: {
        type: String,
        maxlength: [1000, "Message can not be more than 1000 characters"],
    },
    status: {
        type: String,
        enum: ["new", "reviewed", "shortlisted", "rejected"],
        default: "new",
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model("JobApplication", JobApplicationSchema);
