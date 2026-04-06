import {
  collection,
  query,
  where,
  type Query,
  type CollectionReference,
  type DocumentData,
} from 'firebase/firestore';

/**
 * Παγκόσμια πρόσβαση: όλοι οι χρήστες βλέπουν την ίδια συλλογή (κοινή αγορά / social graph).
 * Τα `tenantId` / `isSuperAdmin` παραμένουν στα ορίσματα μόνο για συμβατότητα κλήσεων — δεν φιλτράρουν πλέον.
 */
export function withTenantScope<AppModel extends DocumentData>(
  ref: CollectionReference<AppModel>,
  _tenantId: string | null,
  _isSuperAdmin: boolean
): Query<AppModel> {
  return query(ref);
}

/** Όλοι οι επαγγελματίες στο `users` — χωρίς περιορισμό tenant. */
export function usersProsQuery(
  usersRef: CollectionReference<DocumentData>,
  _tenantId: string | null,
  _isSuperAdmin: boolean
): Query<DocumentData> {
  return query(usersRef, where('role', '==', 'pro'));
}
