import type { Professional } from '../api/types';

export const SUBSCRIPTION_PLANS = {
  monthly: { id: 'monthly' as const, label: 'Μηνιαία', priceEuros: 9.99, durationDays: 30 },
  yearly: { id: 'yearly' as const, label: 'Ετήσια', priceEuros: 49.99, durationDays: 365 },
};

function timestampToMs(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'object' && value !== null && 'toMillis' in value) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const s = (value as { seconds: number }).seconds;
    return typeof s === 'number' ? s * 1000 : null;
  }
  return null;
}

export function trialEndMs(pro: Professional): number | null {
  return timestampToMs(pro.trialEndDate);
}

export function subscriptionEndMs(pro: Professional): number | null {
  return timestampToMs(pro.subscriptionEndsAt);
}

/** true = ο επαγγελματίας πρέπει να δει οθόνη πληρωμής (χωρίς πρόσβαση στα tabs). */
export function isProSubscriptionBlocked(pro: Professional): boolean {
  if (pro.role !== 'pro') return false;
  if (pro.accountStatus === 'deactivated') return true;
  if (pro.accountStatus === 'subscribed') {
    const end = subscriptionEndMs(pro);
    if (end == null) return false;
    return Date.now() > end;
  }
  const trialEnd = trialEndMs(pro);
  if (trialEnd == null) return false;
  return Date.now() > trialEnd;
}

/** Ημέρες μέχρι τη λήξη trial (0 αν έληξε σήμερα, null αν δεν υπάρχει trial). */
export function trialDaysRemaining(pro: Professional): number | null {
  const end = trialEndMs(pro);
  if (end == null) return null;
  const diff = end - Date.now();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}
