/**
 * Αιτήματα ραντεβού στη συλλογή `appointments`.
 */
import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './index';
import { createNotification } from './notifications';
import type { Appointment, AppointmentStatus } from './types';

export async function createAppointmentRequest(
  userId: string,
  proId: string,
  dateMs: number
): Promise<string> {
  const ref = await addDoc(collection(db, 'appointments'), {
    userId,
    proId,
    status: 'pending' as AppointmentStatus,
    date: Timestamp.fromMillis(dateMs),
    price: 0,
    createdAt: serverTimestamp(),
  });
  await createNotification(proId, {
    type: 'appointment_request',
    title: 'Νέο αίτημα ραντεβού',
    body: 'Ένας χρήστης ζήτησε νέο ραντεβού. Άνοιξε τα ραντεβού σου για απάντηση.',
    appointmentId: ref.id,
    fromUserId: userId,
  });
  return ref.id;
}

export async function confirmAppointment(
  appointmentId: string,
  proId: string,
  userId: string
): Promise<void> {
  const ref = doc(db, 'appointments', appointmentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Το ραντεβού δεν βρέθηκε.');
  const d = snap.data() as { proId?: string; userId?: string };
  if (d.proId !== proId) throw new Error('Άρνηση πρόσβασης.');
  await updateDoc(ref, { status: 'confirmed' });
  await createNotification(userId, {
    type: 'appointment_confirmed',
    title: 'Ραντεβού επιβεβαιώθηκε',
    body: 'Ο επαγγελματίας επιβεβαίωσε το ραντεβού σου.',
    appointmentId,
    fromUserId: proId,
  });
}

export async function declineAppointment(
  appointmentId: string,
  proId: string,
  userId: string
): Promise<void> {
  const ref = doc(db, 'appointments', appointmentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Το ραντεβού δεν βρέθηκε.');
  const d = snap.data() as { proId?: string };
  if (d.proId !== proId) throw new Error('Άρνηση πρόσβασης.');
  await updateDoc(ref, { status: 'declined' });
  await createNotification(userId, {
    type: 'appointment_declined',
    title: 'Ραντεβού απορρίφθηκε',
    body: 'Ο επαγγελματίας δεν μπορεί να δεχτεί αυτό το ραντεβού.',
    appointmentId,
    fromUserId: proId,
  });
}

export function subscribeProPendingAppointments(
  proId: string,
  onChange: (rows: (Appointment & { id: string })[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'appointments'),
    where('proId', '==', proId),
    where('status', '==', 'pending'),
    limit(50)
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => mapAppointmentDoc(d.id, d.data() as Record<string, unknown>));
      rows.sort((a, b) => timestampMs(b.date) - timestampMs(a.date));
      onChange(rows);
    },
    () => onChange([])
  );
}

function timestampMs(d: Appointment['date']): number {
  if (d == null) return 0;
  if (typeof d === 'object' && 'toMillis' in d && typeof (d as { toMillis: () => number }).toMillis === 'function') {
    return (d as { toMillis: () => number }).toMillis();
  }
  if (typeof d === 'object' && 'seconds' in d && typeof (d as { seconds: number }).seconds === 'number') {
    return (d as { seconds: number }).seconds * 1000;
  }
  if (d instanceof Date) return d.getTime();
  return 0;
}

function mapAppointmentDoc(id: string, x: Record<string, unknown>): Appointment & { id: string } {
  return {
    id,
    userId: String(x.userId ?? ''),
    proId: String(x.proId ?? ''),
    date: x.date as Appointment['date'],
    status: (x.status as AppointmentStatus) ?? 'pending',
    price: typeof x.price === 'number' ? x.price : 0,
  };
}

export function subscribeUserAppointments(
  userId: string,
  onChange: (rows: (Appointment & { id: string })[]) => void
): Unsubscribe {
  const q = query(collection(db, 'appointments'), where('userId', '==', userId), limit(50));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => mapAppointmentDoc(d.id, d.data() as Record<string, unknown>));
      rows.sort((a, b) => timestampMs(b.date) - timestampMs(a.date));
      onChange(rows);
    },
    () => onChange([])
  );
}
