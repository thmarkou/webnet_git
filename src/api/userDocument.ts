/**
 * Κανονικοποίηση εγγράφων users στο Firestore.
 * Διορθώνει λάθος nesting (π.χ. latitude/firstName μέσα σε friends αντί για root)
 * και εξασφαλίζει αριθμητικά lat/lng στο root.
 */
import { doc, setDoc, type Firestore } from 'firebase/firestore';
import type { User, Professional } from './types';

const HOIST_FROM_FRIENDS = ['latitude', 'longitude', 'firstName', 'lastName', 'lat', 'lng'] as const;

function toFiniteNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(String(value).trim().replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function looksLikeAuthUid(key: string): boolean {
  return /^[a-zA-Z0-9_-]{20,}$/.test(key);
}

/**
 * Εξάγει λίστα friend UIDs όταν το `friends` είναι κατεστραμμένο (object αντί για array).
 */
export function extractFriendIdsFromCorruptFriends(friendsVal: unknown): string[] {
  if (Array.isArray(friendsVal)) {
    return friendsVal.filter((x): x is string => typeof x === 'string');
  }
  if (!friendsVal || typeof friendsVal !== 'object') return [];

  const fobj = friendsVal as Record<string, unknown>;
  const ids: string[] = [];
  for (const [k, v] of Object.entries(fobj)) {
    if ((HOIST_FROM_FRIENDS as readonly string[]).includes(k)) continue;
    if (typeof v === 'string' && looksLikeAuthUid(v)) ids.push(v);
    else if (looksLikeAuthUid(k) && v !== null && typeof v === 'object') ids.push(k);
  }
  return [...new Set(ids)];
}

/**
 * Επιστρέφει επίπεδο αντικείμενο για αποθήκευση: ποτέ nested profile μέσα σε friends.
 */
export function normalizeUserProfileFromFirestore(
  uid: string,
  raw: Record<string, unknown>
): User | Professional {
  const data: Record<string, unknown> = { ...raw };

  const friendsVal = data.friends;
  if (friendsVal && typeof friendsVal === 'object' && !Array.isArray(friendsVal)) {
    const fobj = friendsVal as Record<string, unknown>;
    for (const k of HOIST_FROM_FRIENDS) {
      if (!(k in fobj)) continue;
      const targetKey = k === 'lat' ? 'latitude' : k === 'lng' ? 'longitude' : k;
      if (data[targetKey] === undefined || data[targetKey] === null) {
        data[targetKey] = fobj[k];
      }
    }
    data.friends = extractFriendIdsFromCorruptFriends(friendsVal);
  } else if (Array.isArray(friendsVal)) {
    data.friends = friendsVal.filter((x): x is string => typeof x === 'string');
  } else {
    data.friends = [];
  }

  const lat = toFiniteNumber(data.latitude);
  const lng = toFiniteNumber(data.longitude);
  if (lat !== undefined) data.latitude = lat;
  else delete data.latitude;
  if (lng !== undefined) data.longitude = lng;
  else delete data.longitude;

  const pr = data.pendingRequests;
  if (Array.isArray(pr)) {
    data.pendingRequests = pr.filter((x): x is string => typeof x === 'string');
  } else {
    data.pendingRequests = [];
  }

  return { uid, ...data } as User | Professional;
}

/** Συντεταγμένες για Firestore — μόνο έγκυροι αριθμοί (όχι strings). */
export function finiteCoordsOrUndefined(
  latitude: unknown,
  longitude: unknown
): { latitude: number; longitude: number } | undefined {
  const lat = toFiniteNumber(latitude);
  const lng = toFiniteNumber(longitude);
  if (lat === undefined || lng === undefined) return undefined;
  return { latitude: lat, longitude: lng };
}

/**
 * Αποθήκευση συντεταγμένων στο ROOT του εγγράφου users/{uid} ως numbers.
 * Δεν γράφει τίποτα μέσα στο friends — μόνο merge πεδίων latitude/longitude.
 */
export async function setUserRootCoordinates(
  firestore: Firestore,
  uid: string,
  latitude: number,
  longitude: number
): Promise<void> {
  const lat = toFiniteNumber(latitude);
  const lng = toFiniteNumber(longitude);
  if (lat === undefined || lng === undefined) {
    throw new Error('Άκυρες συντεταγμένες· χρειάζονται πεπερασμένοι αριθμοί.');
  }
  const ref = doc(firestore, 'users', uid);
  await setDoc(
    ref,
    {
      latitude: lat,
      longitude: lng,
    },
    { merge: true }
  );
}
