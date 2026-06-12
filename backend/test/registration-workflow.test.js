const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const express = require('express');

const localStore = path.join(os.tmpdir(), `open-sch-yachal-${process.pid}.json`);
process.env.LOCAL_REGISTRATION_STORE = localStore;
process.env.ADMIN_TOKEN = 'test-admin-token';
process.env.RESEND_API_KEY = '';
process.env.RESEND_FROM_EMAIL = '';

const registrationStore = require('../services/registrationStore');
const registrationRoutes = require('../routes/registrations');
const adminRoutes = require('../routes/admin');
const emailNotifier = require('../services/emailNotifier');

registrationStore.enableFileFallback();

test('Momo registration waits for admin review before becoming paid', async (t) => {
  const app = express();
  app.use(express.json());
  app.use('/api/registrations', registrationRoutes);
  app.use('/api/admin', adminRoutes);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(localStore, { force: true });
  });

  const createdResponse = await fetch(`${baseUrl}/api/registrations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Workflow Test',
      email: 'workflow@example.com',
      phone: '0200000000',
      country: 'Ghana',
      church: 'Yachal House',
      churchRole: 'Member',
      paymentMethod: 'momo',
    }),
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.equal(created.registration.status, 'awaiting-momo-payment');

  const submittedResponse = await fetch(`${baseUrl}/api/registrations/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: created.registration.email,
      momoReference: created.registration.momoReference,
      momoTransactionId: 'TEST-TXN-123',
    }),
  });
  assert.equal(submittedResponse.status, 200);
  const submitted = await submittedResponse.json();
  assert.equal(submitted.registration.status, 'momo-review-pending');

  const adminHeaders = { 'x-admin-token': process.env.ADMIN_TOKEN };
  const listResponse = await fetch(`${baseUrl}/api/admin/registrations`, { headers: adminHeaders });
  assert.equal(listResponse.status, 200);
  const list = await listResponse.json();
  assert.equal(list.registrations.length, 1);
  assert.equal(list.registrations[0].momoTransactionId, 'TEST-TXN-123');

  const confirmResponse = await fetch(
    `${baseUrl}/api/admin/registrations/${created.registration._id}/confirm-payment`,
    { method: 'POST', headers: adminHeaders }
  );
  assert.equal(confirmResponse.status, 200);
  const confirmed = await confirmResponse.json();
  assert.equal(confirmed.registration.status, 'momo-paid');

  const duplicateConfirmResponse = await fetch(
    `${baseUrl}/api/admin/registrations/${created.registration._id}/confirm-payment`,
    { method: 'POST', headers: adminHeaders }
  );
  assert.equal(duplicateConfirmResponse.status, 409);
});

test('emails target both admins and the applicant at each stage', async (t) => {
  const nativeFetch = global.fetch;
  const calls = [];
  process.env.RESEND_API_KEY = 'test-key';
  process.env.RESEND_FROM_EMAIL = 'noreply@yachalhousegh.com';
  delete process.env.REGISTRATION_NOTIFICATION_EMAILS;

  global.fetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return { ok: true, status: 200, json: async () => ({ id: `email-${calls.length}` }) };
  };

  t.after(() => {
    global.fetch = nativeFetch;
    process.env.RESEND_API_KEY = '';
    process.env.RESEND_FROM_EMAIL = '';
  });

  const registration = {
    _id: 'registration-id',
    fullName: 'Email Test',
    email: 'applicant@example.com',
    phone: '0200000000',
    church: 'Yachal House',
    churchRole: 'Member',
    paymentMethod: 'momo',
    momoReference: 'OpenSch-Yachal123',
    momoTransactionId: 'TXN-123',
    status: 'momo-review-pending',
  };

  await emailNotifier.sendRegistrationNotification(registration);
  await emailNotifier.sendApplicantRegistrationReceipt(registration);
  await emailNotifier.sendMomoPaymentReviewNotification(registration);
  await emailNotifier.sendApplicantPaymentReviewReceipt(registration);
  await emailNotifier.sendSlotConfirmation(registration);

  const admins = ['maamekrakuezoom@gmail.com', 'blackbird77ad@gmail.com'];
  assert.deepEqual(calls[0].body.to, admins);
  assert.deepEqual(calls[1].body.to, ['applicant@example.com']);
  assert.deepEqual(calls[2].body.to, admins);
  assert.deepEqual(calls[3].body.to, ['applicant@example.com']);
  assert.deepEqual(calls[4].body.to, ['applicant@example.com']);
  assert.ok(calls.every((call) => call.url === 'https://api.resend.com/emails'));
});
