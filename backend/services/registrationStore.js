const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Registration = require('../models/Registration');

const localStorePath =
  process.env.LOCAL_REGISTRATION_STORE ||
  path.join(__dirname, '..', 'data', 'registrations.local.json');

let fileFallbackEnabled = false;

function enableFileFallback() {
  fileFallbackEnabled = true;
  return localStorePath;
}

function getStoreMode() {
  if (mongoose.connection.readyState === 1) {
    return 'mongo';
  }

  if (fileFallbackEnabled) {
    return 'file';
  }

  return 'unavailable';
}

function createUnavailableError() {
  const error = new Error('Registration storage is temporarily unavailable. Please try again in a moment.');
  error.statusCode = 503;
  return error;
}

function matchesQuery(item, query) {
  return Object.entries(query).every(([key, value]) => item[key] === value);
}

async function readLocalRegistrations() {
  try {
    const contents = await fs.readFile(localStorePath, 'utf8');
    return JSON.parse(contents);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function writeLocalRegistrations(registrations) {
  await fs.mkdir(path.dirname(localStorePath), { recursive: true });
  await fs.writeFile(localStorePath, `${JSON.stringify(registrations, null, 2)}\n`);
}

function toLocalRegistration(data) {
  const now = new Date().toISOString();

  return {
    _id: crypto.randomUUID(),
    fullName: data.fullName,
    email: data.email,
    phone: data.phone,
    country: data.country || 'Ghana',
    church: data.church,
    churchRole: data.churchRole,
    attendanceType: data.attendanceType || 'ghana-center',
    paymentMethod: data.paymentMethod,
    momoReference: data.momoReference,
    momoTransactionId: data.momoTransactionId,
    status: data.status,
    createdAt: now,
    updatedAt: now,
  };
}

function sortNewestFirst(items) {
  return [...items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function findOne(query) {
  const mode = getStoreMode();
  if (mode === 'mongo') {
    return Registration.findOne(query);
  }
  if (mode === 'unavailable') {
    throw createUnavailableError();
  }

  const registrations = await readLocalRegistrations();
  return registrations.find((item) => matchesQuery(item, query)) || null;
}

async function exists(query) {
  const mode = getStoreMode();
  if (mode === 'mongo') {
    return Registration.exists(query);
  }
  if (mode === 'unavailable') {
    throw createUnavailableError();
  }

  const registrations = await readLocalRegistrations();
  return registrations.some((item) => matchesQuery(item, query));
}

async function create(data) {
  const mode = getStoreMode();
  if (mode === 'mongo') {
    return Registration.create(data);
  }
  if (mode === 'unavailable') {
    throw createUnavailableError();
  }

  const registrations = await readLocalRegistrations();
  const duplicate = registrations.some(
    (item) =>
      item.email === data.email ||
      (data.momoReference && item.momoReference === data.momoReference)
  );

  if (duplicate) {
    const error = new Error('Duplicate registration.');
    error.code = 11000;
    throw error;
  }

  const registration = toLocalRegistration(data);
  registrations.push(registration);
  await writeLocalRegistrations(registrations);
  return registration;
}

async function findAllNewestFirst() {
  const mode = getStoreMode();
  if (mode === 'mongo') {
    return Registration.find().sort({ createdAt: -1 });
  }
  if (mode === 'unavailable') {
    throw createUnavailableError();
  }

  const registrations = await readLocalRegistrations();
  return sortNewestFirst(registrations);
}

async function confirmMomoPayment({ email, momoReference, momoTransactionId }) {
  const mode = getStoreMode();
  if (mode === 'mongo') {
    const registration = await Registration.findOne({ email, momoReference });
    if (!registration) {
      return null;
    }

    registration.momoTransactionId = momoTransactionId.trim();
    registration.status = 'momo-paid';
    await registration.save();
    return registration;
  }
  if (mode === 'unavailable') {
    throw createUnavailableError();
  }

  const registrations = await readLocalRegistrations();
  const index = registrations.findIndex((item) => matchesQuery(item, { email, momoReference }));
  if (index === -1) {
    return null;
  }

  registrations[index] = {
    ...registrations[index],
    momoTransactionId: momoTransactionId.trim(),
    status: 'momo-paid',
    updatedAt: new Date().toISOString(),
  };

  await writeLocalRegistrations(registrations);
  return registrations[index];
}

module.exports = {
  create,
  enableFileFallback,
  exists,
  findAllNewestFirst,
  findOne,
  getStoreMode,
  confirmMomoPayment,
};
