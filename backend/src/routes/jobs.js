const express = require("express");
const {
    getJobs,
    getJob,
    createJob,
    updateJob,
    deleteJob,
    getAllJobsAdmin,
    applyForJob
} = require("../controllers/jobController");

const { auth } = require("../middleware/auth");
const router = express.Router();

const upload = require("../middleware/uploadMiddleware");
const { validateJobApplication } = require("../middleware/jobValidators");

const { applyJobLimiter } = require("../middleware/rateLimiter");

// Public routes
router.get("/", getJobs);
router.get("/:id", getJob);
router.post("/apply", applyJobLimiter, upload.single("cv"), validateJobApplication, applyForJob);

// Protected routes
router.get("/admin/all", auth, getAllJobsAdmin);
router.post("/", auth, createJob);
router.put("/:id", auth, updateJob);
router.delete("/:id", auth, deleteJob);

module.exports = router;
