/**
 * Ειδοποιήσεις 5–1 ημέρες πριν τη λήξη trial (μία φορά ανά ημέρα ανά uid).
 */
import { useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Professional } from '../api/types';
import { trialDaysRemaining, trialEndMs } from '../utils/subscription';

const WARN_DAYS = [5, 4, 3, 2, 1] as const;

function storageKey(uid: string, days: number, dateKey: string) {
  return `trial_reminder_${uid}_${days}_${dateKey}`;
}

export function useTrialReminders(pro: Professional | null | undefined, uid: string | undefined) {
  const shownRef = useRef(false);

  const maybeAlert = useCallback(async () => {
    if (!pro || pro.role !== 'pro' || !uid) return;
    if (pro.accountStatus === 'subscribed') return;
    const end = trialEndMs(pro);
    if (end == null || Date.now() > end) return;

    const daysLeft = trialDaysRemaining(pro);
    if (daysLeft == null || !(WARN_DAYS as readonly number[]).includes(daysLeft)) return;

    const dateKey = new Date().toISOString().slice(0, 10);
    const key = storageKey(uid, daysLeft, dateKey);
    const already = await AsyncStorage.getItem(key);
    if (already) return;

    await AsyncStorage.setItem(key, '1');
    Alert.alert(
      'Λήξη δοκιμαστικής περιόδου',
      `Απομένουν ${daysLeft} ημέρες στη δωρεάν περίοδο. Ανανέωσε τη συνδρομή σου για να συνεχίσεις χωρίς διακοπή.`,
      [{ text: 'OK' }]
    );
  }, [pro, uid]);

  useEffect(() => {
    if (shownRef.current) return;
    shownRef.current = true;
    void maybeAlert();
  }, [maybeAlert]);
}
