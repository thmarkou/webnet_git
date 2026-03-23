/**
 * Ευθυγραμμίζει `tenantId` σε όλα τα έγγραφα `cities` και `professions` (π.χ. μετά από crystal
 * που κράτησε τους καταλόγους — αποφεύγονται «ορφανά» tenantId).
 */
import {
  collection,
  getDocs,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

const BATCH_MAX = 500;

const CATALOG_COLLECTIONS = ['cities', 'professions'] as const;

async function reassignCollectionTenantId(
  firestore: Firestore,
  collectionId: string,
  tenantId: string
): Promise<void> {
  const snap = await getDocs(collection(firestore, collectionId));
  if (snap.empty) return;

  let batch = writeBatch(firestore);
  let count = 0;

  for (const d of snap.docs) {
    const current = d.data().tenantId;
    if (current === tenantId) continue;

    batch.update(d.ref, { tenantId });
    count++;
    if (count >= BATCH_MAX) {
      await batch.commit();
      batch = writeBatch(firestore);
      count = 0;
    }
  }
  if (count > 0) await batch.commit();
}

export async function reassignAllCitiesAndProfessionsToTenant(
  firestore: Firestore,
  tenantId: string
): Promise<void> {
  for (const name of CATALOG_COLLECTIONS) {
    await reassignCollectionTenantId(firestore, name, tenantId);
  }
}
