/**
 * Δημιουργεί νέο Firebase Auth χρήστη + έγγραφο `users/{uid}` αντιγράφοντας πεδία από υπάρχον email.
 * Καθαρίζει friends / pendingRequests / favorites για νέο λογαριασμό.
 *
 * Απαιτεί: serviceAccountKey.json στη ρίζα (όπως τα άλλα admin scripts).
 *
 * Ρυθμίσεις (επεξεργασία παρακάτω ή env):
 *   NEW_USER_PASSWORD — κωδικός (Firebase: ελάχιστο 6 χαρακτήρες· το "1234" από μόνο του απορρίπτεται)
 *
 * Τρέξε από τη ρίζα: npm run clone-user
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'serviceAccountKey.json');

const SOURCE_EMAIL = 'theofanis.markou@gmail.com';
const TARGET_EMAIL = 'mi.skal2467@gmail.com';
/** Firebase Auth minimum 6 characters. Override: NEW_USER_PASSWORD=123456 npm run clone-user */
const TARGET_PASSWORD = process.env.NEW_USER_PASSWORD || '123456';

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

async function main() {
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('Λείπει το serviceAccountKey.json στη ρίζα του project.');
    process.exit(1);
  }

  if (TARGET_PASSWORD.length < 6) {
    console.error(
      'Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες (περιορισμός Firebase Auth).'
    );
    console.error('Παράδειγμα: NEW_USER_PASSWORD=123456 npm run clone-user');
    process.exit(1);
  }

  const sa = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  const auth = admin.auth();
  const db = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;

  const srcNorm = normalizeEmail(SOURCE_EMAIL);
  const tgtNorm = normalizeEmail(TARGET_EMAIL);

  let srcUser;
  try {
    srcUser = await auth.getUserByEmail(srcNorm);
  } catch (e) {
    console.error('Δεν βρέθηκε ο πηγαίος χρήστης:', srcNorm, e.message);
    process.exit(1);
  }

  const srcSnap = await db.collection('users').doc(srcUser.uid).get();
  if (!srcSnap.exists) {
    console.error('Δεν υπάρχει έγγραφο Firestore users/' + srcUser.uid);
    process.exit(1);
  }

  let existing;
  try {
    existing = await auth.getUserByEmail(tgtNorm);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
  }

  if (existing) {
    console.error(
      'Υπάρχει ήδη χρήστης με email',
      tgtNorm,
      '(uid:',
      existing.uid + '). Διέγραψέ τον από Console ή άλλαξε TARGET_EMAIL στο script.'
    );
    process.exit(1);
  }

  const created = await auth.createUser({
    email: tgtNorm,
    password: TARGET_PASSWORD,
    emailVerified: false,
  });

  const raw = srcSnap.data();
  const newData = {
    ...raw,
    uid: created.uid,
    email: tgtNorm,
    friends: [],
    pendingRequests: [],
    favorites: [],
    createdAt: FieldValue.serverTimestamp(),
  };

  await db.collection('users').doc(created.uid).set(newData);

  console.log('OK — δημιουργήθηκε χρήστης');
  console.log('  Email:', tgtNorm);
  console.log('  UID:', created.uid);
  console.log('  Κωδικός (όπως στο script / env):', TARGET_PASSWORD.length, 'χαρακτήρες');
  console.log('  Αντιγράφηκε από:', srcNorm, '(' + srcUser.uid + ')');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
