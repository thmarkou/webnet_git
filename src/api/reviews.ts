/**
 * Κριτικές: συλλογή `reviews`, ενημέρωση `ratingAvg` / `totalReviews` στο `users` ή `importedProfessionals`.
 * Id εγγράφου: `{proId}_{reviewerId}` — μία κριτική ανά ζεύγος (αντικατάσταση ενημερώνει μέσο χωρίς να αυξάνει το πλήθος).
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from './index';
import { normalizeUserProfileFromFirestore } from './userDocument';
import { mapImportedProfessionalDoc } from '../utils/importedProfessional';
import type { Professional, Review } from './types';

export function reviewDocId(proId: string, reviewerId: string): string {
  return `${proId}_${reviewerId}`;
}

export async function fetchProfessionalForDisplay(uid: string): Promise<Professional | null> {
  const uSnap = await getDoc(doc(db, 'users', uid));
  if (uSnap.exists()) {
    return normalizeUserProfileFromFirestore(uid, uSnap.data() as Record<string, unknown>) as Professional;
  }
  const iSnap = await getDoc(doc(db, 'importedProfessionals', uid));
  if (iSnap.exists()) {
    return mapImportedProfessionalDoc(uid, iSnap.data() as Record<string, unknown>);
  }
  return null;
}

function mapReviewDoc(id: string, data: Record<string, unknown>): Review {
  return {
    id,
    proId: String(data.proId ?? data.professionalId ?? ''),
    userId: String(data.userId ?? data.reviewerId ?? ''),
    stars: typeof data.stars === 'number' ? data.stars : 0,
    comment: typeof data.comment === 'string' ? data.comment : '',
    timestamp: data.timestamp as Review['timestamp'],
    reviewerName: typeof data.reviewerName === 'string' ? data.reviewerName : undefined,
    reviewerId: typeof data.reviewerId === 'string' ? data.reviewerId : undefined,
    professionalId: typeof data.professionalId === 'string' ? data.professionalId : undefined,
  };
}

/** Όλες οι κριτικές για επαγγελματία (ταξινόμηση: νεότερες πρώτα). */
export async function fetchReviewsForProfessional(proId: string): Promise<Review[]> {
  const q = query(collection(db, 'reviews'), where('proId', '==', proId));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => mapReviewDoc(d.id, d.data() as Record<string, unknown>));
  list.sort((a, b) => {
    const ta = timestampMs(a.timestamp);
    const tb = timestampMs(b.timestamp);
    return tb - ta;
  });
  return list;
}

function timestampMs(t: Review['timestamp']): number {
  if (t == null) return 0;
  if (typeof t === 'object' && 'toMillis' in t && typeof t.toMillis === 'function') {
    return t.toMillis();
  }
  if (typeof t === 'object' && 'seconds' in t && typeof (t as { seconds: number }).seconds === 'number') {
    return (t as { seconds: number }).seconds * 1000;
  }
  if (t instanceof Date) return t.getTime();
  return 0;
}

function proRefForReview(isImported: boolean, proId: string) {
  return isImported ? doc(db, 'importedProfessionals', proId) : doc(db, 'users', proId);
}

export async function submitReview(input: {
  proId: string;
  reviewerId: string;
  reviewerName: string;
  stars: number;
  comment: string;
  isImportedProfessional: boolean;
}): Promise<void> {
  const clampedStars = Math.min(5, Math.max(1, Math.round(input.stars)));
  const rid = reviewDocId(input.proId, input.reviewerId);
  const reviewRef = doc(db, 'reviews', rid);
  const proRef = proRefForReview(input.isImportedProfessional, input.proId);

  await runTransaction(db, async (transaction) => {
    const proSnap = await transaction.get(proRef);
    if (!proSnap.exists()) {
      throw new Error('Ο επαγγελματίας δεν βρέθηκε.');
    }
    const revSnap = await transaction.get(reviewRef);
    const proData = proSnap.data() as { ratingAvg?: unknown; totalReviews?: unknown };
    const oldAvg = typeof proData.ratingAvg === 'number' && Number.isFinite(proData.ratingAvg) ? proData.ratingAvg : 0;
    let oldCount =
      typeof proData.totalReviews === 'number' && Number.isFinite(proData.totalReviews)
        ? proData.totalReviews
        : 0;

    let newAvg: number;
    let newCount: number;

    if (revSnap.exists()) {
      const prev = revSnap.data() as { stars?: unknown };
      const oldStars = typeof prev.stars === 'number' && Number.isFinite(prev.stars) ? prev.stars : 0;
      if (oldCount < 1) oldCount = 1;
      newCount = oldCount;
      newAvg = (oldAvg * oldCount - oldStars + clampedStars) / newCount;
    } else {
      newCount = oldCount + 1;
      newAvg = newCount > 0 ? (oldAvg * oldCount + clampedStars) / newCount : clampedStars;
    }

    transaction.set(
      reviewRef,
      {
        proId: input.proId,
        professionalId: input.proId,
        userId: input.reviewerId,
        reviewerId: input.reviewerId,
        reviewerName: input.reviewerName.trim(),
        stars: clampedStars,
        comment: input.comment.trim(),
        timestamp: serverTimestamp(),
      },
      { merge: true }
    );

    transaction.update(proRef, {
      ratingAvg: newAvg,
      totalReviews: newCount,
    });
  });
}
