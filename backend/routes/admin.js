const express = require('express');
const mongoose = require('mongoose');
const registrationStore = require('../services/registrationStore');
const { sendSlotConfirmation } = require('../services/emailNotifier');

const router = express.Router();

function formatDate(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

router.use((req, res, next) => {
  const adminToken = req.header('x-admin-token');
  if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ message: 'Unauthorized. Provide a valid admin token.' });
  }
  next();
});

router.get('/registrations', async (req, res) => {
  try {
    const registrations = await registrationStore.findAllNewestFirst();
    res.json({
      registrations,
      storage: registrationStore.getStoreMode(),
      database: mongoose.connection.name || null,
    });
  } catch (error) {
    if (error.statusCode === 503) {
      return res.status(503).json({ message: error.message });
    }
    console.error(error);
    res.status(500).json({ message: 'Unable to load registrations.' });
  }
});

router.post('/registrations/:id/confirm-payment', async (req, res) => {
  try {
    const registration = await registrationStore.confirmPayment(req.params.id);
    if (!registration) {
      return res.status(404).json({ message: 'Registration not found.' });
    }

    let email = { sent: false };
    try {
      email = await sendSlotConfirmation(registration);
    } catch (error) {
      console.error('Unable to send slot confirmation email:', error.message);
      email = { sent: false, reason: error.message };
    }

    return res.json({
      message: email.sent
        ? 'Payment confirmed and slot confirmation email sent.'
        : 'Payment confirmed, but the slot confirmation email could not be sent.',
      registration,
      email,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error(error);
    return res.status(500).json({ message: 'Unable to confirm payment.' });
  }
});

router.get('/export', async (req, res) => {
  try {
    const registrations = await registrationStore.findAllNewestFirst();
    const header = [
      'Full Name',
      'Email',
      'Phone',
      'Country',
      'Church',
      'Church Role',
      'Attendance Type',
      'Payment Method',
      'Momo Reference',
      'Momo Transaction ID',
      'Status',
      'Created At',
    ];

    const csvRows = [header.join(',')];

    registrations.forEach((item) => {
      const row = [
        item.fullName,
        item.email,
        item.phone,
        item.country,
        item.church || '',
        item.churchRole || '',
        item.attendanceType,
        item.paymentMethod,
        item.momoReference || '',
        item.momoTransactionId || '',
        item.status,
        formatDate(item.createdAt),
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(',');
      csvRows.push(row);
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="registrations.csv"');
    res.send(csvRows.join('\n'));
  } catch (error) {
    if (error.statusCode === 503) {
      return res.status(503).json({ message: error.message });
    }
    console.error(error);
    res.status(500).json({ message: 'Unable to export registrations.' });
  }
});

module.exports = router;
