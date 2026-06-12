const nodemailer = require('nodemailer');

const defaultRecipients = [
  'maamekrakuezoom@gmail.com',
  'blackbird77ad@gmail.com',
];

let transporter;
let warnedAboutMissingConfig = false;

function getRecipients() {
  const configured = (process.env.REGISTRATION_NOTIFICATION_EMAILS || '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);

  return configured.length > 0 ? configured : defaultRecipients;
}

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    if (!warnedAboutMissingConfig) {
      console.warn('Registration email notifications are disabled until SMTP_HOST, SMTP_USER, and SMTP_PASS are configured.');
      warnedAboutMissingConfig = true;
    }
    return null;
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  return transporter;
}

async function sendRegistrationNotification(registration) {
  const mailer = getTransporter();
  if (!mailer) return { sent: false, reason: 'not-configured' };

  const reference = registration.momoReference || 'Not applicable';
  const subject = `New registration: ${registration.fullName}`;
  const text = [
    'A new Open School of Ministry Ghana registration was submitted.',
    '',
    `Name: ${registration.fullName}`,
    `Email: ${registration.email}`,
    `Phone: ${registration.phone}`,
    `Church: ${registration.church}`,
    `Church role: ${registration.churchRole}`,
    `Payment method: ${registration.paymentMethod}`,
    `Payment status: ${registration.status}`,
    `Momo reference: ${reference}`,
  ].join('\n');

  await mailer.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: getRecipients().join(', '),
    subject,
    text,
  });

  return { sent: true };
}

module.exports = { sendRegistrationNotification };
