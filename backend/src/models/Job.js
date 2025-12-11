const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "Please add a job title"],
            trim: true,
            maxlength: [100, "Title cannot be more than 100 characters"],
        },
        department: {
            type: String,
            required: [true, "Please add a department"],
            trim: true,
        },
        location: {
            type: String,
            required: [true, "Please add a location"],
            trim: true,
        },
        type: {
            type: String,
            default: "Full Time",
            enum: ["Full Time", "Part Time", "Contract", "Freelance", "Internship"],
        },
        salary: {
            type: String,
            trim: true,
        },
        description: {
            type: String,
            required: [true, "Please add a description"],
        },
        responsibilities: {
            type: [String],
            default: [],
        },
        requirements: {
            type: [String],
            default: [],
        },
        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active",
        },
        adminEmail: {
            type: String,
            required: [true, "Please add an admin email for applications"],
            match: [
                /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
                "Please add a valid email",
            ],
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Job", jobSchema);
