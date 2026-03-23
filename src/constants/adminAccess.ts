import { isAdminEmail } from './admin';

/**
 * Προαιρετικό dev override μέσω EXPO_PUBLIC_ADMIN_EMAIL (όχι hardcoded λίστα).
 * Το κύριο Admin/Super Admin έλεγχο κάνει το AuthContext από Firestore.
 */
export function legacyAdminDashboardEmailAllows(email: string | null | undefined): boolean {
  return isAdminEmail(email);
}

/** @deprecated Χρησιμοποίησε useAuth().canAccessAdminDashboard */
export function canAccessAdminDashboard(email: string | null | undefined): boolean {
  return legacyAdminDashboardEmailAllows(email);
}
