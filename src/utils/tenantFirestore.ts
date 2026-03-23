import {
  collection,
  query,
  where,
  type Query,
  type CollectionReference,
  type DocumentData,
} from 'firebase/firestore';

/**
 * Φιλτράρει συλλογή κατά tenant. Super admin → χωρίς φίλτρο (όλα τα έγγραφα).
 */
export function withTenantScope<AppModel extends DocumentData>(
  ref: CollectionReference<AppModel>,
  tenantId: string | null,
  isSuperAdmin: boolean
): Query<AppModel> {
  if (isSuperAdmin) {
    return query(ref);
  }
  if (!tenantId) {
    // Κενό αποτέλεσμα: query που δεν ταιριάζει ποτέ (αποφεύγει να γυρίσουν ξένα δεδομένα)
    return query(ref, where('tenantId', '==', '__no_tenant__'));
  }
  return query(ref, where('tenantId', '==', tenantId));
}

/** Query επαγγελματιών users: role pro + tenantId (ή όλα αν super admin). */
export function usersProsQuery(
  usersRef: CollectionReference<DocumentData>,
  tenantId: string | null,
  isSuperAdmin: boolean
): Query<DocumentData> {
  if (isSuperAdmin) {
    return query(usersRef, where('role', '==', 'pro'));
  }
  if (!tenantId) {
    return query(usersRef, where('role', '==', 'pro'), where('tenantId', '==', '__no_tenant__'));
  }
  return query(usersRef, where('role', '==', 'pro'), where('tenantId', '==', tenantId));
}
