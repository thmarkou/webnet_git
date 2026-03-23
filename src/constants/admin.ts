/**
 * Πρόσβαση Admin UI: όρισε EXPO_PUBLIC_ADMIN_EMAIL στο .env ή app config.
 * Προειδοποίηση: το κλειδί είναι μόνο για UX· ασφάλεια = Firestore Security Rules στο backend.
 */
export const ADMIN_EMAIL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ADMIN_EMAIL) || '';

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email || !ADMIN_EMAIL) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase();
}
