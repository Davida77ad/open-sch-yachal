const express = require('express');
const registrationStore = require('../services/registrationStore');
const {
  sendApplicantPaymentReviewReceipt,
  sendApplicantRegistrationReceipt,
  sendMomoPaymentReviewNotification,
  sendRegistrationNotification,
} = require('../services/emailNotifier');
const { generateOrReuseReference } = require('../utils/reference');

const router = express.Router();

function sendStorageError(res, error, fallbackMessage) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  if (error.code === 11000) {
    return res.status(409).json({ message: 'Email or momo reference already exists.' });
  }

  console.error(error);
  return res.status(500).json({ message: fallbackMessage });
}

async function sendNotifications(notifications, context) {
  const results = await Promise.allSettled(notifications.map((notification) => notification()));
  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.error(`Unable to send ${context} email:`, result.reason.message);
    }
  });
  return results;
}

router.post('/', async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      country = 'Ghana',
      church,
      churchRole,
      attendanceType = 'ghana-center',
      paymentMethod,
    } = req.body;

    if (!fullName || !email || !phone || !paymentMethod || !church || !churchRole) {
      return res.status(400).json({ message: 'Name, email, phone, church, church role, and payment method are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await registrationStore.findOne({ email: normalizedEmail });

    if (existing) {
      if (existing.paymentMethod === 'momo' && existing.status === 'awaiting-momo-payment') {
        return res.status(200).json({
          message: 'A momo payment reference already exists for this email.',
          registration: existing,
        });
      }
      return res.status(409).json({ message: 'This email is already registered.' });
    }

    let momoReference;
    let status;
    if (paymentMethod === 'momo') {
      momoReference = await generateOrReuseReference(normalizedEmail);
      status = 'awaiting-momo-payment';
    } else {
      status = 'cash-pending';
    }

    const registration = await registrationStore.create({
      fullName,
      email: normalizedEmail,
      phone,
      country,
      church,
      churchRole,
      attendanceType,
      paymentMethod,
      momoReference,
      status,
    });

    await sendNotifications([
      () => sendRegistrationNotification(registration),
      () => sendApplicantRegistrationReceipt(registration),
    ], 'registration');

    res.status(201).json({ message: 'Registration created.', registration });
  } catch (error) {
    sendStorageError(res, error, 'Unable to save registration.');
  }
});

router.post('/confirm', async (req, res) => {
  try {
    const { email, momoReference, momoTransactionId } = req.body;
    if (!email || !momoReference || !momoTransactionId) {
      return res.status(400).json({ message: 'Email, momo reference, and transaction ID are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const registration = await registrationStore.submitMomoPayment({
      email: normalizedEmail,
      momoReference,
      momoTransactionId,
    });
    if (!registration) {
      return res.status(404).json({ message: 'Could not find matching registration.' });
    }

    await sendNotifications([
      () => sendMomoPaymentReviewNotification(registration),
      () => sendApplicantPaymentReviewReceipt(registration),
    ], 'payment review');

    res.status(200).json({
      message: 'Form submitted successfully. Your payment is awaiting admin review.',
      registration,
    });
  } catch (error) {
    sendStorageError(res, error, 'Unable to confirm momo payment.');
  }
});

module.exports = router;
