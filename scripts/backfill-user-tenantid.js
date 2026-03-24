/**
 * Μία φορά (προαιρετικά): σε όλα τα users χωρίς tenantId προσθέτει tenantId: "tenant_default".
 * Η εφαρμογή κάνει ήδη το ίδιο αυτόματα σε κάθε σύνδεση — αυτό το script χρησιμοποίησέ το
 * αν θες να καθαρίσεις τη βάση χωρίς να περιμένεις login όλων.
 *
 * Τρέξε από τη ρίζα: npm run backfill-user-tenants
 * Απαιτεί serviceAccountKey.json στη ρίζα (όπως τα άλλα admin scripts).
 */
const admin = require('firebase-admin');
const path = require('path');

const DEFAULT_TENANT_ID = 'tenant_default';
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'serviceAccountKey.json');

function missingTenantId(data) {
  const t = data.tenantId;
  if (t == null) return true;
  if (typeof t !== 'string') return true;
  return t.trim() === '';
}

async function main() {
  const fs = require('fs');
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('Λείπει το serviceAccountKey.json στη ρίζα του project.');
    process.exit(1);
  }
  const sa = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
  const db = admin.firestore();
  const snap = await db.collection('users').get();
  let updated = 0;
  let skipped = 0;
  for (const d of snap.docs) {
    const data = d.data();
    if (!missingTenantId(data)) {
      skipped += 1;
      continue;
    }
    await d.ref.set({ tenantId: DEFAULT_TENANT_ID }, { merge: true });
    updated += 1;
    console.log('OK', d.id);
  }
  console.log(`Τέλος: ενημερώθηκαν ${updated}, παραλείφθηκαν (ήδη tenant) ${skipped}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
