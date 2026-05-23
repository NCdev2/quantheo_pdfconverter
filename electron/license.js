const Store = require('electron-store');
const crypto = require('crypto');
const store = new Store();

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0au6+82bw1Can8E/hWJQ
urMewl2MxoOVoS7LudLx5qE9FgHOKsKAoHM6rwQxJuIH7EfWacz9Qmg5HMyN+PGS
iTVljZc4l+VurpOnDeoPZ0h9TDtKJ/FVAv1cRMpOiojihBtAEb+uu5acVAZswZOa
zmgN/JQ+46nG/Rw2LXgx7gE+edJ0Edn0hvsntuMH4GEuvWvCrM3SWsHijVlM9KpG
DVkTW/jKi7uIxdKYu/qzVVVSXic+6Lx/TT03dMCW7LV44aG3HHR4luDz6M4l0oe2
sOxHnYe9Dii3b+4+NIvg3qBQtXW8AJqJsktoODWLQc20p1+/yi+cJKKuW86+zN3N
2wIDAQAB
-----END PUBLIC KEY-----`;

function verifyLicense(licenseString) {
  try {
    const obj = JSON.parse(Buffer.from(licenseString, 'base64').toString('utf8'));
    const verify = crypto.createVerify('SHA256');
    verify.update(obj.payload);
    verify.end();
    const isValid = verify.verify(PUBLIC_KEY, obj.signature, 'base64');
    if (!isValid) return { valid: false, error: 'Invalid cryptographic signature' };

    const payload = JSON.parse(obj.payload);
    if (Date.now() > payload.expiry) return { valid: false, error: 'License has expired' };

    return { valid: true, payload };
  } catch (e) {
    return { valid: false, error: 'Malformed license string' };
  }
}

function getLicenseStatus() {
  let firstLaunch = store.get('firstLaunch');
  if (!firstLaunch) {
    firstLaunch = Date.now();
    store.set('firstLaunch', firstLaunch);
  }

  const savedLicense = store.get('license');
  if (savedLicense) {
    const check = verifyLicense(savedLicense);
    if (check.valid) return { status: 'licensed', owner: check.payload.owner, expiry: check.payload.expiry };
    // Don't auto delete, just let it fall through to expired or trial so user can fix it
  }

  const daysSinceLaunch = (Date.now() - firstLaunch) / (1000 * 60 * 60 * 24);
  if (daysSinceLaunch > 30) {
    return { status: 'expired', daysRemaining: 0 };
  }
  return { status: 'trial', daysRemaining: Math.ceil(30 - daysSinceLaunch) };
}

function applyLicense(licenseString) {
  const check = verifyLicense(licenseString);
  if (check.valid) {
    store.set('license', licenseString);
    return { ok: true, owner: check.payload.owner, expiry: check.payload.expiry };
  }
  return { ok: false, error: check.error };
}

module.exports = { getLicenseStatus, applyLicense };
