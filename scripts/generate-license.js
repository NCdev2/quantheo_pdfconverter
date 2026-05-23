const crypto = require('crypto');
const fs = require('fs');

// Generate a keypair
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

console.log("==========================================");
console.log("SAVE THIS PRIVATE KEY SECURELY. NEVER SHARE IT.");
console.log(privateKey);
console.log("==========================================");

console.log("EMBED THIS PUBLIC KEY IN YOUR ELECTRON MAIN.JS:");
console.log(publicKey);
console.log("==========================================");

// Function to generate a license
function generateLicense(ownerName) {
  const issueDate = Date.now();
  const expiryDate = issueDate + (365 * 24 * 60 * 60 * 1000); // 1 year from now

  const payload = {
    owner: ownerName,
    issue: issueDate,
    expiry: expiryDate
  };

  const payloadStr = JSON.stringify(payload);

  const sign = crypto.createSign('SHA256');
  sign.update(payloadStr);
  sign.end();
  const signature = sign.sign(privateKey, 'base64');

  const licenseObj = {
    payload: payloadStr,
    signature: signature
  };

  return Buffer.from(JSON.stringify(licenseObj)).toString('base64');
}

console.log("GENERATED KEYS:");
console.log("1. " + generateLicense("Customer 1"));
console.log("2. " + generateLicense("Customer 2"));
console.log("3. " + generateLicense("Customer 3"));
