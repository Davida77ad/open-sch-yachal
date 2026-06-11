const Registration = require('../models/Registration');

async function generateOrReuseReference(email) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = await Registration.findOne({ email: normalizedEmail });
  if (existing?.momoReference) {
    return existing.momoReference;
  }

  let code;
  let reference;
  let tries = 0;
  do {
    code = String(Math.floor(100 + Math.random() * 900));
    reference = `OpenSch-Yachal${code}`;
    const exists = await Registration.exists({ momoReference: reference });
    if (!exists) break;
    tries += 1;
  } while (tries < 20);

  return reference;
}

module.exports = { generateOrReuseReference };
