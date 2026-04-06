/**
 * Φιλίες: υποσυλλογή `users/{recipientUid}/friend_requests/{senderUid}`.
 * Ο αποστολέας δημιουργεί το έγγραφο στον παραλήπτη· η αποδοχή ενημερώνει και τα δύο `friends` arrays.
 */
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './index';
import { createNotification } from './notifications';
import type { FirestoreTimestampish, FriendRequestDoc } from './types';

type FriendRequestRow = { id: string; data: FriendRequestDoc };

export const FRIEND_REQUESTS_SUB = 'friend_requests';

export function friendRequestDocRef(recipientUid: string, senderUid: string) {
  return doc(db, 'users', recipientUid, FRIEND_REQUESTS_SUB, senderUid);
}

export async function hasPendingOutgoing(fromUid: string, toUid: string): Promise<boolean> {
  const s = await getDoc(friendRequestDocRef(toUid, fromUid));
  return s.exists();
}

export async function sendFriendRequest(
  fromUid: string,
  toUid: string,
  fromProfile: { firstName: string; lastName: string; phone?: string }
): Promise<void> {
  if (fromUid === toUid) {
    throw new Error('Δεν μπορείς να στείλεις αίτημα στον εαυτό σου.');
  }
  const toRef = doc(db, 'users', toUid);
  const toSnap = await getDoc(toRef);
  if (!toSnap.exists()) {
    throw new Error('Ο χρήστης δεν βρέθηκε.');
  }
  const toData = toSnap.data() as { friends?: unknown };
  const friends = Array.isArray(toData.friends)
    ? (toData.friends as string[])
    : [];
  if (friends.includes(fromUid)) {
    throw new Error('Είστε ήδη φίλοι.');
  }
  const pending = await getDoc(friendRequestDocRef(toUid, fromUid));
  if (pending.exists()) {
    throw new Error('Η αίτηση εκκρεμεί ήδη.');
  }
  const incomingToMe = await getDoc(friendRequestDocRef(fromUid, toUid));
  if (incomingToMe.exists()) {
    throw new Error('Υπάρχει ήδη αίτημα από αυτόν τον χρήστη — δέξου την από τα εισερχόμενα.');
  }

  await setDoc(friendRequestDocRef(toUid, fromUid), {
    fromUid,
    toUid,
    status: 'pending',
    fromFirstName: fromProfile.firstName.trim(),
    fromLastName: fromProfile.lastName.trim(),
    ...(fromProfile.phone?.trim() ? { fromPhone: fromProfile.phone.trim() } : {}),
    createdAt: serverTimestamp(),
  });

  const fromLabel = `${fromProfile.firstName} ${fromProfile.lastName}`.trim() || 'Χρήστης';
  await createNotification(toUid, {
    type: 'friend_request',
    title: 'Νέο αίτημα φιλίας',
    body: `Ο/Η ${fromLabel} σου έστειλε αίτημα φιλίας.`,
    fromUserId: fromUid,
  });
}

export async function acceptFriendRequest(recipientUid: string, senderUid: string): Promise<void> {
  const reqRef = friendRequestDocRef(recipientUid, senderUid);
  const reqSnap = await getDoc(reqRef);
  if (!reqSnap.exists()) {
    throw new Error('Η αίτηση δεν βρέθηκε.');
  }
  const batch = writeBatch(db);
  batch.delete(reqRef);
  batch.update(doc(db, 'users', recipientUid), {
    friends: arrayUnion(senderUid),
  });
  batch.update(doc(db, 'users', senderUid), {
    friends: arrayUnion(recipientUid),
  });
  await batch.commit();
}

export async function declineFriendRequest(recipientUid: string, senderUid: string): Promise<void> {
  await deleteDoc(friendRequestDocRef(recipientUid, senderUid));
}

export async function cancelOutgoingFriendRequest(fromUid: string, toUid: string): Promise<void> {
  await deleteDoc(friendRequestDocRef(toUid, fromUid));
}

export async function unfriend(uidA: string, uidB: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', uidA), { friends: arrayRemove(uidB) });
  batch.update(doc(db, 'users', uidB), { friends: arrayRemove(uidA) });
  await batch.commit();
}

/** Εισερχόμενα αιτήματα (realtime). */
export function subscribeIncomingFriendRequests(
  recipientUid: string,
  onChange: (rows: FriendRequestRow[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  const col = collection(db, 'users', recipientUid, FRIEND_REQUESTS_SUB);
  return onSnapshot(
    col,
    (snap) => {
      const rows = snap.docs.map((d) => {
        const x = d.data() as Record<string, unknown>;
        const createdAt = x.createdAt as FirestoreTimestampish | undefined;
        return {
          id: d.id,
          data: {
            fromUid: String(x.fromUid ?? d.id),
            toUid: String(x.toUid ?? recipientUid),
            status: 'pending' as const,
            fromFirstName: typeof x.fromFirstName === 'string' ? x.fromFirstName : '',
            fromLastName: typeof x.fromLastName === 'string' ? x.fromLastName : '',
            fromPhone: typeof x.fromPhone === 'string' ? x.fromPhone : undefined,
            ...(createdAt !== undefined ? { createdAt } : {}),
          },
        };
      });
      onChange(rows);
    },
    (err) => onError?.(err instanceof Error ? err : new Error(String(err)))
  );
}

/** Φόρτωση όλων των απλών χρηστών για τοπικό φιλτράρισμα (όνομα/τηλέφωνο). */
export async function fetchUserRoleUserDocs(max = 400): Promise<
  { uid: string; data: Record<string, unknown> }[]
> {
  const q = query(collection(db, 'users'), where('role', '==', 'user'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, data: d.data() as Record<string, unknown> }));
}
