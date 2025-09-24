const Newsletter = require('../models/Newsletter');
const { createTransporter } = require('../config/email');

/**
 * Subscribe to newsletter
 * @route POST /api/newsletter/subscribe
 * @access Public
 */
const subscribeToNewsletter = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Check if email already exists
    const existingSubscription = await Newsletter.findOne({ email: email.toLowerCase() });
    
    if (existingSubscription) {
      if (existingSubscription.isActive) {
        return res.status(409).json({
          success: false,
          message: 'Email is already subscribed to our newsletter'
        });
      } else {
        // Reactivate subscription
        existingSubscription.isActive = true;
        existingSubscription.unsubscribedAt = null;
        existingSubscription.subscribedAt = new Date();
        await existingSubscription.save();
        
        return res.status(200).json({
          success: true,
          message: 'Successfully resubscribed to newsletter'
        });
      }
    }

    // Create new subscription
    const newSubscription = new Newsletter({
      email: email.toLowerCase(),
      source: 'website_footer'
    });

    await newSubscription.save();

    // Send welcome email (optional)
    try {
      const transporter = createTransporter();
      const mailOptions = {
        from: `"EarlyBirds Properties" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Welcome to EarlyBirds Properties Newsletter!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Welcome to EarlyBirds Properties!</h2>
            <p>Thank you for subscribing to our newsletter. You'll now receive the latest updates about:</p>
            <ul>
              <li>New property listings</li>
              <li>Market insights and trends</li>
              <li>Investment opportunities</li>
              <li>Company news and updates</li>
            </ul>
            <p>We're excited to have you as part of our community!</p>
            <p>Best regards,<br>The EarlyBirds Properties Team</p>
            <hr style="margin: 20px 0;">
            <p style="font-size: 12px; color: #666;">
              If you wish to unsubscribe, please contact us at info@earlybirdsproperties.com
            </p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
      // Don't fail the subscription if email sending fails
    }

    res.status(201).json({
      success: true,
      message: 'Successfully subscribed to newsletter'
    });

  } catch (error) {
    console.error('Newsletter subscription error:', error);
    
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Email is already subscribed'
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to subscribe to newsletter. Please try again later.'
    });
  }
};

/**
 * Unsubscribe from newsletter
 * @route POST /api/newsletter/unsubscribe
 * @access Public
 */
const unsubscribeFromNewsletter = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const subscription = await Newsletter.findOne({ email: email.toLowerCase() });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Email not found in our newsletter list'
      });
    }

    if (!subscription.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Email is already unsubscribed'
      });
    }

    subscription.isActive = false;
    subscription.unsubscribedAt = new Date();
    await subscription.save();

    res.status(200).json({
      success: true,
      message: 'Successfully unsubscribed from newsletter'
    });

  } catch (error) {
    console.error('Newsletter unsubscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unsubscribe. Please try again later.'
    });
  }
};

/**
 * Get newsletter statistics (for admin use)
 * @route GET /api/newsletter/stats
 * @access Private (would need auth middleware)
 */
const getNewsletterStats = async (req, res) => {
  try {
    const totalSubscribers = await Newsletter.countDocuments({ isActive: true });
    const totalUnsubscribed = await Newsletter.countDocuments({ isActive: false });
    const recentSubscribers = await Newsletter.find({ isActive: true })
      .sort({ subscribedAt: -1 })
      .limit(10)
      .select('email subscribedAt');

    res.status(200).json({
      success: true,
      data: {
        totalSubscribers,
        totalUnsubscribed,
        recentSubscribers
      }
    });

  } catch (error) {
    console.error('Newsletter stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch newsletter statistics'
    });
  }
};

module.exports = {
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
  getNewsletterStats
};