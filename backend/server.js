const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const registrationRoutes = require('./routes/registrations');
const adminRoutes = require('./routes/admin');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));

app.use('/api/registrations', registrationRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Open School of Ministry Ghana registration API' });
});

const PORT = process.env.PORT || 4000;

mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/open-school-yachal')
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  });
