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

// Public routes
router.get("/", getJobs);
router.get("/:id", getJob);
router.post("/apply", applyForJob);

// Protected routes
router.get("/admin/all", auth, getAllJobsAdmin);
router.post("/", auth, createJob);
router.put("/:id", auth, updateJob);
router.delete("/:id", auth, deleteJob);

module.exports = router;
