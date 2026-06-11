const express = require('express');
const Registration = require('../models/Registration');

const router = express.Router();

router.use((req, res, next) => {
  const adminToken = req.header('x-admin-token');
  if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ message: 'Unauthorized. Provide a valid admin token.' });
  }
  next();
});

router.get('/registrations', async (req, res) => {
  try {
    const registrations = await Registration.find().sort({ createdAt: -1 });
    res.json({ registrations });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to load registrations.' });
  }
});

router.get('/export', async (req, res) => {
  try {
    const registrations = await Registration.find().sort({ createdAt: -1 });
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
        item.createdAt.toISOString(),
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(',');
      csvRows.push(row);
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="registrations.csv"');
    res.send(csvRows.join('\n'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to export registrations.' });
  }
});

module.exports = router;
