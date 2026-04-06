/**
 * Συνομιλίες: `chats/{chatId}` με υποσυλλογή `messages`.
 * chatId = `{userId}_{professionalId}` (ρόλος user ↔ επαγγελματίας).
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
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './index';
import { createNotification } from './notifications';
import type { FirestoreTimestampish } from './types';

export function chatIdFor(userId: string, professionalId: string): string {
  return `${userId}_${professionalId}`;
}

export async function ensureChatDocument(userId: string, professionalId: string): Promise<string> {
  const id = chatIdFor(userId, professionalId);
  await setDoc(
    doc(db, 'chats', id),
    {
      userId,
      professionalId,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return id;
}

export type ChatMessageRow = {
  id: string;
  text: string;
  senderId: string;
  createdAt?: FirestoreTimestampish;
};

export function subscribeChatMessages(
  chatId: string,
  onChange: (messages: ChatMessageRow[]) => void,
  maxMessages = 300
): Unsubscribe {
  const q = query(
    collection(db, 'chats', chatId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(maxMessages)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => {
        const x = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          text: String(x.text ?? ''),
          senderId: String(x.senderId ?? ''),
          createdAt: x.createdAt as FirestoreTimestampish | undefined,
        };
      });
      onChange(list);
    },
    () => onChange([])
  );
}

export async function sendChatMessage(
  chatId: string,
  senderId: string,
  text: string,
  recipientId: string,
  previewTitle: string
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    text: trimmed,
    senderId,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'chats', chatId), { updatedAt: serverTimestamp() });

  if (recipientId !== senderId) {
    await createNotification(recipientId, {
      type: 'chat_message',
      title: 'Νέο μήνυμα',
      body: previewTitle.length > 80 ? `${previewTitle.slice(0, 77)}…` : previewTitle,
      chatId,
      fromUserId: senderId,
    });
  }
}
