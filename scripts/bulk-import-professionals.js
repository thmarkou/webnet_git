/**
 * Μαζική δημιουργία επαγγελματιών από Excel (Auth UID = document ID).
 *
 * Στήλες (κεφαλίδες): Email*, Password?, FirstName, LastName, Name (επωνυμία),
 * BusinessName, Category (επάγγελμα), City, Address, Lat, Lng, VAT (9 ψηφία)
 *
 * Τρέξε: npm run bulk-import-pros -- ./professionals.xlsx
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'serviceAccountKey.json');
const TRIAL_MS = 30 * 24 * 60 * 60 * 1000;

function normKeys(row) {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [String(k).trim().toLowerCase(), v])
  );
}

function cell(row, ...keys) {
  const n = normKeys(row);
  for (const k of keys) {
    const v = n[k.toLowerCase()];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function randomPassword() {
  return `Imp${Math.random().toString(36).slice(2)}${Date.now().toString(36)}!`;
}

async function main() {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) {
    console.error('Χρήση: npm run bulk-import-pros -- path/to/file.xlsx');
    process.exit(1);
  }
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('Λείπει serviceAccountKey.json');
    process.exit(1);
  }

  const serviceAccount = require(SERVICE_ACCOUNT_PATH);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();
  const auth = admin.auth();

  const wb = XLSX.readFile(file);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  let ok = 0;
  for (const row of rows) {
    const email = cell(row, 'email', 'ηλεκτρονικό');
    if (!email) {
      console.warn('Skip row χωρίς email');
      continue;
    }
    const password = cell(row, 'password', 'κωδικός') || randomPassword();
    const firstName = cell(row, 'firstname', 'όνομα') || '—';
    const lastName = cell(row, 'lastname', 'επώνυμο') || '—';
    const businessName =
      cell(row, 'businessname', 'επωνυμία') || cell(row, 'name', 'όνομα επιχείρησης') || 'Επιχείρηση';
    const profession = cell(row, 'category', 'επάγγελμα', 'profession') || '—';
    const city = cell(row, 'city', 'πόλη') || '—';
    const address = cell(row, 'address', 'διεύθυνση') || '';
    const lat = parseFloat(cell(row, 'lat', 'latitude').replace(',', '.'));
    const lng = parseFloat(cell(row, 'lng', 'longitude', 'lon').replace(',', '.'));
    const vat = cell(row, 'vat', 'αφμ').replace(/\D/g, '').slice(0, 9) || '000000000';

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      console.warn('Skip', email, '- άκυρα Lat/Lng');
      continue;
    }

    let userRecord;
    try {
      userRecord = await auth.createUser({ email, password, emailVerified: false });
    } catch (e) {
      console.warn('Auth skip', email, e.message);
      continue;
    }

    const uid = userRecord.uid;
    const trialEndDate = admin.firestore.Timestamp.fromMillis(Date.now() + TRIAL_MS);

    await db.collection('users').doc(uid).set({
      uid,
      email,
      role: 'pro',
      firstName,
      lastName,
      phone: '',
      profession,
      location: `${city}, Ελλάδα`,
      friends: [],
      pendingRequests: [],
      businessName,
      vat,
      website: '',
      bio: '',
      address,
      addressNumber: '',
      area: '',
      zip: '',
      city,
      country: 'Ελλάδα',
      profileDisplayType: 'company',
      profileImageBase64: null,
      latitude: lat,
      longitude: lng,
      services: [],
      ratingAvg: 0,
      totalReviews: 0,
      availableToday: false,
      trialEndDate,
      accountStatus: 'trial',
      subscriptionPlan: null,
    });

    console.log('OK', email, uid);
    ok += 1;
  }

  console.log('Done. Created', ok, 'professionals.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
