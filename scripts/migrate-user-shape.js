/**
 * Μία φορά: ισιώνει έγγραφα users όπου lat/lng/firstName/lastName έχουν μπει λάθος μέσα σε friends.
 * Τρέξε: npm run migrate-user-shape
 * Απαιτεί serviceAccountKey.json στη ρίζα του project.
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'serviceAccountKey.json');
const HOIST = ['latitude', 'longitude', 'firstName', 'lastName', 'lat', 'lng'];

function toNum(v) {
  if (v == null) return undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(String(v).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

function uidLike(k) {
  return /^[a-zA-Z0-9_-]{20,}$/.test(k);
}

function normalizeUserData(data) {
  const d = { ...data };
  const friendsVal = d.friends;

  if (friendsVal && typeof friendsVal === 'object' && !Array.isArray(friendsVal)) {
    const fobj = friendsVal;
    for (const k of HOIST) {
      if (!(k in fobj)) continue;
      const target = k === 'lat' ? 'latitude' : k === 'lng' ? 'longitude' : k;
      if (d[target] == null) d[target] = fobj[k];
    }
    const ids = [];
    for (const [k, v] of Object.entries(fobj)) {
      if (HOIST.includes(k)) continue;
      if (typeof v === 'string' && uidLike(v)) ids.push(v);
      else if (uidLike(k) && v !== null && typeof v === 'object') ids.push(k);
    }
    d.friends = [...new Set(ids)];
  } else if (Array.isArray(friendsVal)) {
    d.friends = friendsVal.filter((x) => typeof x === 'string');
  } else {
    d.friends = [];
  }

  const lat = toNum(d.latitude);
  const lng = toNum(d.longitude);
  if (lat !== undefined) d.latitude = lat;
  else delete d.latitude;
  if (lng !== undefined) d.longitude = lng;
  else delete d.longitude;

  const pr = d.pendingRequests;
  d.pendingRequests = Array.isArray(pr) ? pr.filter((x) => typeof x === 'string') : [];

  return d;
}

async function main() {
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('Λείπει serviceAccountKey.json');
    process.exit(1);
  }
  const serviceAccount = require(SERVICE_ACCOUNT_PATH);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();
  const snap = await db.collection('users').get();
  let n = 0;
  for (const docRef of snap.docs) {
    const before = docRef.data();
    const after = normalizeUserData(before);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      await docRef.ref.set(after);
      n += 1;
      console.log('Updated', docRef.id);
    }
  }
  console.log('Done. Updated', n, 'document(s).');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
