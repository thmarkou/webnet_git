/**
 * Firestore `system_config/globals` — Super Admin: emails + uids (τα rules ελέγχουν uid γιατί
 * το `request.auth.token.email` δεν υπάρχει πάντα στο JWT στο mobile).
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { db } from './firebaseConfig';

export const SYSTEM_CONFIG_COLLECTION = 'system_config';
export const GLOBALS_DOC_ID = 'globals';

/** Όταν το έγγραφο `globals` υπάρχει (ακόμα κι αν η λίστα email είναι κενή). */
export type SystemGlobalsFetched = {
  superAdminEmails: string[];
  superAdminUids: string[];
};

export interface SystemGlobalsDoc {
  superAdminEmails?: string[];
  superAdminUids?: string[];
}

export function normalizeEmailForCompare(email: string): string {
  return email.trim().toLowerCase();
}

export function parseSuperAdminEmails(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((e) => (typeof e === 'string' ? normalizeEmailForCompare(e) : ''))
    .filter(Boolean);
}

export function isEmailInSuperAdminList(email: string | null | undefined, list: string[]): boolean {
  const e = normalizeEmailForCompare(email ?? '');
  if (!e) return false;
  return list.includes(e);
}

export function parseSuperAdminUids(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((u) => (typeof u === 'string' ? u.trim() : '')).filter(Boolean);
}

export function isUidInSuperAdminList(uid: string | null | undefined, list: string[]): boolean {
  const u = (uid ?? '').trim();
  if (!u) return false;
  return list.includes(u);
}

/** Για κάθε normalized email, προσθέτει τα uid από `users` όπου `email` ταιριάζει. */
export async function resolveUidsForSuperAdminEmails(
  firestore: Firestore,
  normalizedEmails: string[]
): Promise<string[]> {
  const uidSet = new Set<string>();
  const unique = [...new Set(normalizedEmails.filter(Boolean))];
  for (const em of unique) {
    try {
      const snap = await getDocs(
        query(collection(firestore, 'users'), where('email', '==', em), limit(8))
      );
      for (const d of snap.docs) uidSet.add(d.id);
    } catch {
      /* αγνοούμε αποτυχία ανά email */
    }
  }
  return [...uidSet];
}

/** Payload για `updateDoc` / `setDoc` στο `system_config/globals`. */
export async function buildGlobalsSuperAdminPayload(
  firestore: Firestore,
  normalizedEmails: string[]
): Promise<{ superAdminEmails: string[]; superAdminUids: string[] }> {
  const superAdminEmails = [...new Set(normalizedEmails.filter(Boolean))];
  const superAdminUids = await resolveUidsForSuperAdminEmails(firestore, superAdminEmails);
  return { superAdminEmails, superAdminUids };
}

/**
 * `null` = λείπει το έγγραφο (κρυστάλλινη βάση).
 * Αντικείμενο = υπάρχει doc.
 * Σε σφάλμα δικτύου → `null` (όχι throw).
 */
export async function fetchSystemGlobals(
  firestore: Firestore = db
): Promise<SystemGlobalsFetched | null> {
  try {
    const snap = await getDoc(doc(firestore, SYSTEM_CONFIG_COLLECTION, GLOBALS_DOC_ID));
    if (!snap.exists()) {
      return null;
    }
    const data = snap.data() as SystemGlobalsDoc;
    return {
      superAdminEmails: parseSuperAdminEmails(data.superAdminEmails),
      superAdminUids: parseSuperAdminUids(data.superAdminUids),
    };
  } catch {
    return null;
  }
}
