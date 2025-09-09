/**
 * Email Routes
 * Handles email sending functionality
 */

const express = require('express');
const router = express.Router();
const { sendContactEmail, sendInstantValuationEmail, sendPropertyInquiryEmail } = require('../controllers/emailController');

/**
 * @route   POST /api/email/contact
 * @desc    Send email from contact form
 * @access  Public
 */
router.post('/contact', sendContactEmail);

/**
 * @route   POST /api/email/property-inquiry
 * @desc    Send property inquiry email
 * @access  Public
 */
router.post('/property-inquiry', sendPropertyInquiryEmail);

/**
 * @route   POST /api/email/instant-valuation
 * @desc    Send instant valuation email
 * @access  Public
 */
router.post('/instant-valuation', sendInstantValuationEmail);

module.exports = router;