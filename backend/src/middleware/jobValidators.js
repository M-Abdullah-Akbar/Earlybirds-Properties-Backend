const { check, validationResult } = require("express-validator");

exports.validateJobApplication = [
    check("name", "Name is required").trim().not().isEmpty(),
    check("email", "Please include a valid email").isEmail().normalizeEmail(),
    check("phone", "Phone number is required").not().isEmpty(),
    check("jobId", "Job ID is required").isMongoId(),
    check("message")
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage("Message cannot exceed 1000 characters"),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }
        next();
    },
];
