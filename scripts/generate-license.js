require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');

let publicKey = process.env.PUBLIC_KEY;
let privateKey = process.env.PRIVATE_KEY;

// If we stored multi-line strings with \n in the .env file, we need to unescape them
if (publicKey) publicKey = publicKey.replace(/\\n/g, '\n');
if (privateKey) privateKey = privateKey.replace(/\\n/g, '\n');

if (!publicKey || !privateKey) {
  console.log("Keys not found in .env. Generating new keypair...");
  const keys = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  publicKey = keys.publicKey;
  privateKey = keys.privateKey;

  // Save to .env (escape newlines so it stays on one line per variable)
  const escapedPublic = publicKey.replace(/\n/g, '\\n');
  const escapedPrivate = privateKey.replace(/\n/g, '\\n');
  
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8') + '\n';
  }
  
  envContent += `PRIVATE_KEY="${escapedPrivate}"\n`;
  envContent += `PUBLIC_KEY="${escapedPublic}"\n`;
  
  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log("New keys saved to .env file.");
  
  // NOTE: You still need to manually copy the PUBLIC_KEY to electron/license.js
  console.log("==========================================");
  console.log("EMBED THIS PUBLIC KEY IN YOUR ELECTRON license.js:");
  console.log(publicKey);
  console.log("==========================================");
} else {
  console.log("Loaded existing keys from .env file.");
}

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
