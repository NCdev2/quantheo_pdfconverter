const Store = require('electron-store');
const crypto = require('crypto');
const store = new Store();

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoYyoE+5vrYd23MQZQGBS
LyV4oOTfUaNjUp1U09T4ADzpxizXsYw6zzpCzB1S3UPpxpo7LCqmMfOE/n7zH8Cm
TxzVAH+6DmxWDZWlbXLH+ksBfBUqO4pu6k8nm9qrW4sG2dS7w7HeIDrvbwRz5Fcv
1raC1EYHO6LtQz4gTN4B3vy++aPttjjDYKYKBLnvws53FR2tDErjRS4OUDJpbcEw
+LSSTA54yDNWTREvjAl6C7WqhZnVa9oBu+iKvb+BX//fJ7uz8VRLrYbVURPnR8Gd
ipsgzwQ1VAh/eL4bkZC6N5Jtl3H1IDtDybzykU6lZauc8JEJsKaOjbEsAcOUnGM7
twIDAQAB
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
