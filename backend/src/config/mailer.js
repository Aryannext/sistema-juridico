const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

const sendEmail = async ({ to, subject, html }) => {
  try {
    const mailOptions = {
      from: `"SGPA Notificaciones" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    };
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

module.exports = { sendEmail };
