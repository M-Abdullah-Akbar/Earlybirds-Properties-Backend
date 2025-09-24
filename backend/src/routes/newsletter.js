/**
 * Newsletter Routes
 * Handles newsletter subscription functionality
 */

const express = require('express');
const router = express.Router();
const { 
  subscribeToNewsletter, 
  unsubscribeFromNewsletter, 
  getNewsletterStats 
} = require('../controllers/newsletterController');

/**
 * @route   POST /api/newsletter/subscribe
 * @desc    Subscribe to newsletter
 * @access  Public
 */
router.post('/subscribe', subscribeToNewsletter);

/**
 * @route   POST /api/newsletter/unsubscribe
 * @desc    Unsubscribe from newsletter
 * @access  Public
 */
router.post('/unsubscribe', unsubscribeFromNewsletter);

/**
 * @route   GET /api/newsletter/stats
 * @desc    Get newsletter statistics
 * @access  Private (would need auth middleware in production)
 */
router.get('/stats', getNewsletterStats);

module.exports = router;