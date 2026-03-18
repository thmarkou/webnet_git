/**
 * One-time script to update Firebase Auth user passwords.
 * Run: npm run update-passwords
 *
 * Requires:
 * 1. serviceAccountKey.json in project root (from Firebase Console → Service Accounts)
 * 2. password-updates.config.json with the users and new passwords (see example)
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'serviceAccountKey.json');
const CONFIG_PATH = path.join(__dirname, 'password-updates.config.json');

async function main() {
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('Missing serviceAccountKey.json');
    console.error('1. Go to Firebase Console → Project Settings → Service Accounts');
    console.error('2. Click "Generate new private key"');
    console.error('3. Save as serviceAccountKey.json in the webnet_app folder');
    process.exit(1);
  }

  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('Missing password-updates.config.json');
    console.error('Copy scripts/password-updates.config.example.json to scripts/password-updates.config.json');
    console.error('Then edit it with the emails and new passwords.');
    process.exit(1);
  }

  const UPDATES = require(CONFIG_PATH);
  const serviceAccount = require(SERVICE_ACCOUNT_PATH);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const auth = admin.auth();

  for (const { email, password } of UPDATES) {
    try {
      const user = await auth.getUserByEmail(email);
      await auth.updateUser(user.uid, { password });
      console.log(`✓ Updated password for ${email}`);
    } catch (err) {
      console.error(`✗ Failed for ${email}:`, err.message);
    }
  }

  console.log('Done.');
  process.exit(0);
}

main();
