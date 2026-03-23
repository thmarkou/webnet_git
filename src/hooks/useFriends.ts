/**
 * Custom hook for friends logic
 * Handles friend list, pending requests, add/accept/decline
 */
import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../api';
import { normalizeUserProfileFromFirestore } from '../api/userDocument';
import type { User } from '../api/types';

export function useFriends(userId: string | undefined) {
  const [friends, setFriends] = useState<User[]>([]);
  const [pendingRequests, setPendingRequests] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFriends = useCallback(async () => {
    if (!userId) {
      setFriends([]);
      setPendingRequests([]);
      setLoading(false);
      return;
    }

    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();
      const normalized = userData
        ? normalizeUserProfileFromFirestore(userId, userData as Record<string, unknown>)
        : null;

      const friendIds = normalized?.friends ?? [];
      const pendingIds = normalized?.pendingRequests ?? [];

      const [friendDocs, pendingDocs] = await Promise.all([
        Promise.all(friendIds.map((id) => getDoc(doc(db, 'users', id)))),
        Promise.all(pendingIds.map((id) => getDoc(doc(db, 'users', id)))),
      ]);

      setFriends(
        friendDocs
          .filter((d) => d.exists())
          .map((d) => ({ uid: d.id, ...d.data() } as User))
      );
      setPendingRequests(
        pendingDocs
          .filter((d) => d.exists())
          .map((d) => ({ uid: d.id, ...d.data() } as User))
      );
    } catch {
      setFriends([]);
      setPendingRequests([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const acceptRequest = useCallback(
    async (fromUserId: string) => {
      if (!userId) return;
      const userRef = doc(db, 'users', userId);
      const fromRef = doc(db, 'users', fromUserId);
      await updateDoc(userRef, {
        pendingRequests: arrayRemove(fromUserId),
        friends: arrayUnion(fromUserId),
      });
      await updateDoc(fromRef, { friends: arrayUnion(userId) });
      await fetchFriends();
    },
    [userId, fetchFriends]
  );

  const declineRequest = useCallback(
    async (fromUserId: string) => {
      if (!userId) return;
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { pendingRequests: arrayRemove(fromUserId) });
      await fetchFriends();
    },
    [userId, fetchFriends]
  );

  return {
    friends,
    pendingRequests,
    loading,
    refetch: fetchFriends,
    acceptRequest,
    declineRequest,
  };
}
