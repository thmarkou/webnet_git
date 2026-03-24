/**
 * «Crystal» για νέο πρώτο setup (νέος Super Admin / tenants / χρήστες) χωρίς να σβήνονται
 * οι βοηθητικοί κατάλογοι `cities` και `professions`.
 * Η σειρά κρατάει `system_config/globals` τελευταίο ώστε το `isSuperAdmin()` να ισχύει μέχρι το τέλος.
 */
import {
  collection,
  getDocs,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { SYSTEM_CONFIG_COLLECTION } from './systemConfig';

const BATCH_MAX = 500;

/** Συλλογές που διαγράφονται πριν το system_config. ΔΕΝ σβήνονται: `cities`, `professions`. */
const ROOT_COLLECTIONS_BEFORE_SYSTEM_CONFIG = [
  'reviews',
  'deleted_professionals',
  'importedProfessionals',
  'tenants',
  'users',
] as const;

async function deleteAllDocsInCollection(
  firestore: Firestore,
  collectionId: string
): Promise<void> {
  const snap = await getDocs(collection(firestore, collectionId));
  if (snap.empty) return;

  let batch = writeBatch(firestore);
  let count = 0;

  for (const d of snap.docs) {
    batch.delete(d.ref);
    count++;
    if (count >= BATCH_MAX) {
      await batch.commit();
      batch = writeBatch(firestore);
      count = 0;
    }
  }
  if (count > 0) await batch.commit();
}

/**
 * @throws Error με μήνυμα αν αποτύχει commit (π.χ. permissions).
 */
export async function resetFirestoreToCrystal(firestore: Firestore): Promise<void> {
  for (const name of ROOT_COLLECTIONS_BEFORE_SYSTEM_CONFIG) {
    await deleteAllDocsInCollection(firestore, name);
  }
  await deleteAllDocsInCollection(firestore, SYSTEM_CONFIG_COLLECTION);
}
