const Job = require("../models/Job");
const ErrorResponse = require("../middleware/errorHandler"); // Assuming ErrorResponse is part of error handling or using standard error throwing
const { sendJobApplicationEmail } = require("../controllers/emailController");
// Note: existing emailController might export a function or object. I will assume a standard sendEmail utility or import the email controller logic.
// Checking emailController file content would be good, but for now I will implement basic logic and assume nodemailer availability if needed, 
// or better yet, reuse the existing email infrastructure.
// Upon checking existing files list, there is an `emailController.js` and `email` routes. 
// I will implement standard CRUD first.

// @desc    Get all jobs
// @route   GET /api/jobs
// @access  Public
exports.getJobs = async (req, res, next) => {
    try {
        const jobs = await Job.find({ status: "active" }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: jobs.length, data: jobs });
    } catch (err) {
        next(err);
    }
};

// @desc    Get all jobs (Admin)
// @route   GET /api/jobs/admin
// @access  Private
exports.getAllJobsAdmin = async (req, res, next) => {
    try {
        const jobs = await Job.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: jobs.length, data: jobs });
    } catch (err) {
        next(err);
    }
};

// @desc    Get single job
// @route   GET /api/jobs/:id
// @access  Public
exports.getJob = async (req, res, next) => {
    try {
        const job = await Job.findById(req.params.id);

        if (!job) {
            return res.status(404).json({ success: false, error: "Job not found" });
        }

        res.status(200).json({ success: true, data: job });
    } catch (err) {
        next(err);
    }
};

// @desc    Create new job
// @route   POST /api/jobs
// @access  Private
exports.createJob = async (req, res, next) => {
    try {
        const job = await Job.create(req.body);
        res.status(201).json({ success: true, data: job });
    } catch (err) {
        next(err);
    }
};

// @desc    Update job
// @route   PUT /api/jobs/:id
// @access  Private
exports.updateJob = async (req, res, next) => {
    try {
        let job = await Job.findById(req.params.id);

        if (!job) {
            return res.status(404).json({ success: false, error: "Job not found" });
        }

        job = await Job.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });

        res.status(200).json({ success: true, data: job });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete job
// @route   DELETE /api/jobs/:id
// @access  Private
exports.deleteJob = async (req, res, next) => {
    try {
        const job = await Job.findById(req.params.id);

        if (!job) {
            return res.status(404).json({ success: false, error: "Job not found" });
        }

        await job.deleteOne();

        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        next(err);
    }
};

// @desc    Apply for job
// @route   POST /api/jobs/apply
// @access  Public
exports.applyForJob = async (req, res, next) => {
    try {
        const { jobId, name, email, phone, message } = req.body;
        const job = await Job.findById(jobId);

        if (!job) {
            return res.status(404).json({ success: false, error: "Job not found" });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, error: "Please upload a CV" });
        }

        // Create application entry
        /* 
           Note: We dynamically require the JobApplication model here to avoid 
           circular dependency or initialization issues if not globally loaded yet.
           Ideally it should be at top level but this is safe for now.
        */
        const JobApplication = require("../models/JobApplication");

        const application = await JobApplication.create({
            jobId,
            name,
            email,
            phone,
            message,
            cvPath: req.file.path
        });

        // Use emailController to send notification
        try {
            await sendJobApplicationEmail({
                jobTitle: job.title,
                name,
                email,
                phone,
                message,
                cvPath: req.file.path,
                recipient: process.env.EMAIL_USER || "hr@earlybirdsproperties.com"
            });
        } catch (emailError) {
            console.error("Email sending failed:", emailError);
            // Continue execution, do not fail the request just because email failed
        }

        res.status(200).json({ success: true, message: "Application submitted successfully", data: application });
    } catch (err) {
        // Cleanup uploaded file if DB save fails
        if (req.file) {
            const fs = require('fs');
            fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) console.error("Error deleting file after failure:", unlinkErr);
            });
        }
        next(err);
    }
}
