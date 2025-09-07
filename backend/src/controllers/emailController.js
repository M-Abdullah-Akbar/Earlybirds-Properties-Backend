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

module.exports = {
  sendContactEmail,
  sendInstantValuationEmail
};