/**
 * Deletes all user-related Firebase data. Keeps app reference data (cities/professions
 * live in src/constants/catalog.json, not Firestore).
 *
 * Removes: Firestore `reviews`, Firestore `users`, Storage `profiles/*`, all Auth users.
 *
 * Run: npm run wipe-user-data
 *
 * Requires serviceAccountKey.json in project root (Firebase Console → Service Accounts).
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'serviceAccountKey.json');
/** Match src/api/firebaseConfig.ts storageBucket if env not set */
const DEFAULT_STORAGE_BUCKET = 'webnet-db-4c78f.appspot.com';

async function deleteCollectionInBatches(db, collectionId, batchSize = 300) {
  const col = db.collection(collectionId);
  for (;;) {
    const snap = await col.limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

async function deleteStorageProfiles(bucket) {
  try {
    const [files] = await bucket.getFiles({ prefix: 'profiles/' });
    if (files.length === 0) return;
    await Promise.all(files.map((f) => f.delete().catch(() => {})));
  } catch (e) {
    console.warn('Storage (profiles/) skipped:', e.message || e);
  }
}

async function deleteAllAuthUsers(auth) {
  let pageToken;
  let total = 0;
  do {
    const res = await auth.listUsers(1000, pageToken);
    for (const u of res.users) {
      await auth.deleteUser(u.uid);
      total += 1;
    }
    pageToken = res.pageToken;
  } while (pageToken);
  return total;
}

async function main() {
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('Missing serviceAccountKey.json in project root.');
    console.error('Firebase Console → Project Settings → Service Accounts → Generate new private key');
    process.exit(1);
  }

  const serviceAccount = require(SERVICE_ACCOUNT_PATH);
  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET || DEFAULT_STORAGE_BUCKET;
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket,
  });

  const db = admin.firestore();
  const auth = admin.auth();
  const bucket = admin.storage().bucket(storageBucket);

  console.log('Deleting Firestore collection: reviews …');
  await deleteCollectionInBatches(db, 'reviews');
  console.log('Deleting Firestore collection: users …');
  await deleteCollectionInBatches(db, 'users');

  console.log('Deleting Storage prefix profiles/ …');
  await deleteStorageProfiles(bucket);

  console.log('Deleting all Firebase Auth users …');
  const n = await deleteAllAuthUsers(auth);
  console.log(`Removed ${n} Auth user(s).`);

  console.log('Done. Cities/professions unchanged (catalog.json in repo).');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
