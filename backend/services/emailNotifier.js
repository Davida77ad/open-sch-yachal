const defaultRecipients = [
  'maamekrakuezoom@gmail.com',
  'blackbird77ad@gmail.com',
];

const SUPPORT_PHONE = '0544600600';
let warnedAboutMissingConfig = false;

function getRecipients() {
  const configured = (process.env.REGISTRATION_NOTIFICATION_EMAILS || '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);

  return configured.length > 0 ? configured : defaultRecipients;
}

function getConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    if (!warnedAboutMissingConfig) {
      console.warn('Registration email notifications are disabled until RESEND_API_KEY and RESEND_FROM_EMAIL are configured.');
      warnedAboutMissingConfig = true;
    }
    return null;
  }

  return { apiKey, from };
}

async function sendEmail({ to, subject, text, idempotencyKey }) {
  const config = getConfig();
  if (!config) return { sent: false, reason: 'not-configured' };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      from: config.from,
      to: Array.isArray(to) ? to : [to],
      subject,
      text,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Resend returned HTTP ${response.status}.`);
  }

  return { sent: true, id: data.id };
}

function registrationDetails(registration) {
  return [
    `Name: ${registration.fullName}`,
    `Email: ${registration.email}`,
    `Phone: ${registration.phone}`,
    `Church: ${registration.church}`,
    `Church role: ${registration.churchRole}`,
    `Payment method: ${registration.paymentMethod}`,
    `Payment status: ${registration.status}`,
    `Momo reference: ${registration.momoReference || 'Not applicable'}`,
    `Momo transaction ID: ${registration.momoTransactionId || 'Not submitted'}`,
  ];
}

function sendRegistrationNotification(registration) {
  return sendEmail({
    to: getRecipients(),
    subject: `New registration: ${registration.fullName}`,
    idempotencyKey: `registration-admin-${registration._id}`,
    text: [
      'A new Open School of Ministry Ghana registration was submitted.',
      '',
      ...registrationDetails(registration),
      '',
      'Review registrations in the admin dashboard.',
    ].join('\n'),
  });
}

function sendApplicantRegistrationReceipt(registration) {
  const paymentInstructions = registration.paymentMethod === 'momo'
    ? `Complete the Momo payment to ${SUPPORT_PHONE} using reference ${registration.momoReference}, then submit your transaction ID on the registration page.`
    : 'Your registration has been received. Please pay cash in person at the Ghana center.';

  return sendEmail({
    to: registration.email,
    subject: 'Your Open School of Ministry registration was received',
    idempotencyKey: `registration-applicant-${registration._id}`,
    text: [
      `Hello ${registration.fullName},`,
      '',
      'Your Open School of Ministry Ghana registration has been received.',
      paymentInstructions,
      '',
      `For assistance, contact ${SUPPORT_PHONE}.`,
    ].join('\n'),
  });
}

function sendMomoPaymentReviewNotification(registration) {
  return sendEmail({
    to: getRecipients(),
    subject: `Momo payment awaiting review: ${registration.fullName}`,
    idempotencyKey: `payment-review-admin-${registration._id}-${registration.momoTransactionId}`,
    text: [
      'A Momo transaction ID has been submitted and requires admin review.',
      '',
      ...registrationDetails(registration),
      '',
      'Confirm the payment in the admin dashboard only after verifying that the payment was received.',
    ].join('\n'),
  });
}

function sendApplicantPaymentReviewReceipt(registration) {
  return sendEmail({
    to: registration.email,
    subject: 'Your Momo payment is awaiting review',
    idempotencyKey: `payment-review-applicant-${registration._id}-${registration.momoTransactionId}`,
    text: [
      `Hello ${registration.fullName},`,
      '',
      'Your form and Momo transaction ID were submitted successfully.',
      'An admin will review your payment. After it is confirmed, you will receive another email confirming your slot.',
      '',
      `For assistance, contact ${SUPPORT_PHONE}.`,
    ].join('\n'),
  });
}

function sendSlotConfirmation(registration) {
  return sendEmail({
    to: registration.email,
    subject: 'Your Open School of Ministry slot is confirmed',
    idempotencyKey: `slot-confirmed-${registration._id}`,
    text: [
      `Hello ${registration.fullName},`,
      '',
      'Your payment has been confirmed and your slot for the Open School of Ministry Ghana center is secured.',
      'The Ghana center is at Yachal House, Ridge Accra.',
      '',
      `For assistance, contact ${SUPPORT_PHONE}.`,
    ].join('\n'),
  });
}

module.exports = {
  sendApplicantPaymentReviewReceipt,
  sendApplicantRegistrationReceipt,
  sendMomoPaymentReviewNotification,
  sendRegistrationNotification,
  sendSlotConfirmation,
};
