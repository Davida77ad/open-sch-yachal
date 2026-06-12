const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const registrationRoutes = require('./routes/registrations');
const adminRoutes = require('./routes/admin');
const { enableFileFallback, getStoreMode } = require('./services/registrationStore');

dotenv.config();

const app = express();
app.use(express.json());
const allowedOrigins = [
  'http://localhost:5173',
  'https://register.yachalhousegh.com',
  'https://open-sch-yachal.pages.dev',
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
  })
);

app.use('/api/registrations', registrationRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'Open School of Ministry Ghana registration API',
    storage: getStoreMode(),
  });
});

const PORT = process.env.PORT || 4001;

// Start server immediately
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Connect to MongoDB
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/open-school-yachal';
const defaultMongoTimeoutMs = process.env.NODE_ENV === 'production' ? 30000 : 5000;
const mongoTimeoutMs = Number(process.env.MONGODB_TIMEOUT_MS || defaultMongoTimeoutMs);
const canUseFileFallback = process.env.NODE_ENV !== 'production' && process.env.ENABLE_FILE_FALLBACK !== 'false';
const fallbackPath = canUseFileFallback ? enableFileFallback() : null;

if (fallbackPath) {
  console.warn(`Local file registration store ready at ${fallbackPath}`);
}

mongoose
  .connect(mongoUri, { serverSelectionTimeoutMS: mongoTimeoutMs })
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('MongoDB connection failed:', error.message);
    if (fallbackPath) {
      console.warn(`Continuing with local file registration store at ${fallbackPath}`);
      return;
    }

    console.warn('Server running but database unavailable. Requests will fail gracefully.');
  });
