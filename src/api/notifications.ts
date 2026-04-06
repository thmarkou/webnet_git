/**
 * Ειδοποιήσεις: υποσυλλογή `users/{uid}/notifications/{id}`.
 */
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  getDocs,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './index';
import type { FirestoreTimestampish, NotificationDoc, NotificationType } from './types';

export const NOTIFICATIONS_SUB = 'notifications';

export async function createNotification(
  targetUserId: string,
  payload: {
    type: NotificationType;
    title: string;
    body: string;
    chatId?: string;
    appointmentId?: string;
    fromUserId?: string;
  }
): Promise<void> {
  await addDoc(collection(db, 'users', targetUserId, NOTIFICATIONS_SUB), {
    type: payload.type,
    title: payload.title,
    body: payload.body,
    read: false,
    createdAt: serverTimestamp(),
    ...(payload.chatId ? { chatId: payload.chatId } : {}),
    ...(payload.appointmentId ? { appointmentId: payload.appointmentId } : {}),
    ...(payload.fromUserId ? { fromUserId: payload.fromUserId } : {}),
  });
}

export function subscribeUserNotifications(
  userId: string,
  onChange: (rows: (NotificationDoc & { id: string })[]) => void,
  maxDocs = 200
): Unsubscribe {
  const q = query(
    collection(db, 'users', userId, NOTIFICATIONS_SUB),
    orderBy('createdAt', 'desc'),
    limit(maxDocs)
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => {
        const x = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          type: x.type as NotificationType,
          title: String(x.title ?? ''),
          body: String(x.body ?? ''),
          read: Boolean(x.read),
          createdAt: x.createdAt as FirestoreTimestampish | undefined,
          chatId: typeof x.chatId === 'string' ? x.chatId : undefined,
          appointmentId: typeof x.appointmentId === 'string' ? x.appointmentId : undefined,
          fromUserId: typeof x.fromUserId === 'string' ? x.fromUserId : undefined,
        };
      });
      onChange(rows);
    },
    () => onChange([])
  );
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId, NOTIFICATIONS_SUB, notificationId), { read: true });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const q = query(
    collection(db, 'users', userId, NOTIFICATIONS_SUB),
    where('read', '==', false),
    limit(100)
  );
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { read: true })));
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const q = query(
    collection(db, 'users', userId, NOTIFICATIONS_SUB),
    where('read', '==', false),
    limit(100)
  );
  const snap = await getDocs(q);
  return snap.size;
}
