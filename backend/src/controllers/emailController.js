const { createTransporter } = require('../config/email');

/**
 * Send email from contact form
 * @route POST /api/email/contact
 * @access Public
 */
const sendContactEmail = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      propertyStatus,
      userInfo,
      maxPrice,
      minSize,
      bedrooms,
      bathrooms,
      message,
      recipient = process.env.EMAIL_USER
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email and message'
      });
    }

    const transporter = createTransporter();

    // Setup email data
    const mailOptions = {
      from: `"EarlyBirds Properties" <${process.env.EMAIL_USER}>`,
      to: recipient,
      subject: `Contact Form: ${propertyStatus || 'General'} Inquiry from ${firstName} ${lastName}`,
      html: `
        <h2>Contact Form Submission</h2>
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
        ${propertyStatus ? `<p><strong>Property Status:</strong> ${propertyStatus}</p>` : ''}
        ${userInfo ? `<p><strong>User Info:</strong> ${userInfo}</p>` : ''}
        ${maxPrice ? `<p><strong>Max Price:</strong> ${maxPrice}</p>` : ''}
        ${minSize ? `<p><strong>Min Size (Sq Ft):</strong> ${minSize}</p>` : ''}
        ${bedrooms ? `<p><strong>Bedrooms:</strong> ${bedrooms}</p>` : ''}
        ${bathrooms ? `<p><strong>Bathrooms:</strong> ${bathrooms}</p>` : ''}
        <p><strong>Message:</strong> ${message}</p>
      `,
      replyTo: email
    };

    // Send mail
    const info = await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: 'Email sent successfully',
      messageId: info.messageId
    });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send email',
      error: error.message
    });
  }
};

/**
 * Send property inquiry email
 * @route POST /api/email/property-inquiry
 * @access Public
 */
const sendPropertyInquiryEmail = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      message,
      propertyId,
      propertyTitle,
      agent,
      type = 'property_inquiry',
      recipient = process.env.EMAIL_USER
    } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, phone and message'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    const transporter = createTransporter();

    // Email to agent/company
    const agentEmailOptions = {
      from: `"EarlyBirds Properties" <${process.env.EMAIL_USER}>`,
      to: recipient,
      subject: `New Property Inquiry - ${propertyTitle || 'Property'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #bd8c31;">New Property Inquiry</h2>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Contact Information:</h3>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone}</p>
          </div>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Property Details:</h3>
            <p><strong>Property ID:</strong> ${propertyId || 'N/A'}</p>
            <p><strong>Property Title:</strong> ${propertyTitle || 'N/A'}</p>
            <p><strong>Agent:</strong> ${agent}</p>
          </div>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Message:</h3>
            <p>${message}</p>
          </div>
          <p style="color: #666; font-size: 12px;">This inquiry was submitted through the EarlyBirds Properties website.</p>
        </div>
      `,
      replyTo: email
    };

    // Confirmation email to customer
    const customerEmailOptions = {
      from: `"EarlyBirds Properties" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Thank you for your property inquiry - EarlyBirds Properties',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #bd8c31;">Thank you for your inquiry!</h2>
          <p>Dear ${name},</p>
          <p>Thank you for your interest in our property. We have received your inquiry and our team will get back to you within 24 hours.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Your Inquiry Details:</h3>
            <p><strong>Property:</strong> ${propertyTitle || 'Property'}</p>
            <p><strong>Agent:</strong> ${agent}</p>
            <p><strong>Your Message:</strong> ${message}</p>
          </div>
          
          <p>If you have any urgent questions, please don't hesitate to contact us directly:</p>
          <p><strong>Phone:</strong> +971 561615675</p>
          <p><strong>Email:</strong> info@earlybirdsproperties.com</p>
          
          <p>Best regards,<br>EarlyBirds Properties Team</p>
          
          <p style="color: #666; font-size: 12px;">This is an automated confirmation email. Please do not reply to this email.</p>
        </div>
      `
    };

    // Send both emails
    await Promise.all([
      transporter.sendMail(agentEmailOptions),
      transporter.sendMail(customerEmailOptions)
    ]);

    res.status(200).json({
      success: true,
      message: 'Property inquiry sent successfully'
    });
  } catch (error) {
    console.error('Error sending property inquiry email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send property inquiry',
      error: error.message
    });
  }
};

/**
 * Send instant valuation email
 * @route POST /api/email/instant-valuation
 * @access Public
 */
const sendInstantValuationEmail = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      propertyStatus,
      propertyType,
      emirate,
      beds,
      size,
      price,
      images,
      recipient = process.env.EMAIL_USER
    } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !propertyStatus || !propertyType || !emirate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const transporter = createTransporter();

    // Setup email data
    const mailOptions = {
      from: `"EarlyBirds Properties" <${process.env.EMAIL_USER}>`,
      to: recipient,
      subject: `Instant Valuation Request: ${propertyType} in ${emirate}`,
      html: `
        <h2>Instant Valuation Request</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Property Status:</strong> ${propertyStatus}</p>
        <p><strong>Property Type:</strong> ${propertyType}</p>
        <p><strong>Emirate:</strong> ${emirate}</p>
        ${beds ? `<p><strong>Bedrooms:</strong> ${beds}</p>` : ''}
        ${size ? `<p><strong>Size (Sq Ft):</strong> ${size}</p>` : ''}
        ${price ? `<p><strong>Expected Price:</strong> ${price}</p>` : ''}
        ${images && images.length > 0 ? `
          <p><strong>Images:</strong></p>
          <ul>
            ${images.map(image => `<li><a href="${image.url}" target="_blank">${image.originalName || 'Property Image'}</a></li>`).join('')}
          </ul>
        ` : "<p><strong>Images:</strong> No images uploaded</p>"}
      `,
      replyTo: email
    };

    // Send mail
    const info = await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: 'Valuation request sent successfully',
      messageId: info.messageId
    });
  } catch (error) {
    console.error('Error sending valuation email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send valuation request',
      error: error.message
    });
  }
};

/**
 * Send job application email
 * @param {Object} data - Application data
 */
const sendJobApplicationEmail = async (data) => {
  try {
    const {
      jobTitle,
      name,
      email,
      phone,
      message,
      cvPath,
      recipient = process.env.EMAIL_USER
    } = data;

    const transporter = createTransporter();

    // Setup email data
    const mailOptions = {
      from: `"EarlyBirds Properties" <${process.env.EMAIL_USER}>`,
      to: recipient,
      subject: `New Application: ${jobTitle} - ${name}`,
      html: `
        <h2>New Job Application</h2>
        <p><strong>Job Title:</strong> ${jobTitle}</p>
        <p><strong>Applicant Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Message:</strong></p>
        <blockquote style="background: #f9f9f9; padding: 10px; border-left: 5px solid #ccc;">
          ${message.replace(/\n/g, '<br>')}
        </blockquote>
        <p>The CV is attached to this email.</p>
      `,
      attachments: [
        {
          path: cvPath
        }
      ]
    };

    // Send mail
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending job application email:', error);
    throw error;
  }
};

module.exports = {
  sendContactEmail,
  sendInstantValuationEmail,
  sendPropertyInquiryEmail,
  sendJobApplicationEmail
};