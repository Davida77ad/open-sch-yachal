const express = require('express');
const Registration = require('../models/Registration');
const { generateOrReuseReference } = require('../utils/reference');

const router = express.Router();

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
    const existing = await Registration.findOne({ email: normalizedEmail });

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

    const registration = await Registration.create({
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

    res.status(201).json({ message: 'Registration created.', registration });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Email or momo reference already exists.' });
    }
    console.error(error);
    res.status(500).json({ message: 'Unable to save registration.' });
  }
});

router.post('/confirm', async (req, res) => {
  try {
    const { email, momoReference, momoTransactionId } = req.body;
    if (!email || !momoReference || !momoTransactionId) {
      return res.status(400).json({ message: 'Email, momo reference, and transaction ID are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const registration = await Registration.findOne({ email: normalizedEmail, momoReference });
    if (!registration) {
      return res.status(404).json({ message: 'Could not find matching registration.' });
    }

    registration.momoTransactionId = momoTransactionId.trim();
    registration.status = 'momo-paid';
    await registration.save();

    res.status(200).json({ message: 'Payment confirmed and registration completed.', registration });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to confirm momo payment.' });
  }
});

module.exports = router;
