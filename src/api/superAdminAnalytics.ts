/**
 * Συγκεντρωτικά στατιστικά πλατφόρμας για Super Admin (ανάγνωση Firestore).
 */
import { collection, getDocs } from 'firebase/firestore';
import { db } from './index';

export type RankedLabel = { label: string; count: number };

export type SuperAdminGlobalStats = {
  usersEndUser: number;
  usersProfessional: number;
  usersSuperAdmin: number;
  friendConnectionsCount: number;
  appointmentsTotal: number;
  appointmentsLast7Days: number;
  reviewsTotal: number;
  newUsersLast7Days: number;
  topProfessions: RankedLabel[];
  topCities: RankedLabel[];
  /** Όλοι οι επαγγελματίες (ρόλος pro) */
  proMembersTotal: number;
  /** Pro με ενεργή συνδρομή (accountStatus ή subscriptionPlan) */
  proSubscribedCount: number;
};

function timestampMs(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis: () => number }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof value === 'object' && 'seconds' in value && typeof (value as { seconds: number }).seconds === 'number') {
    return (value as { seconds: number }).seconds * 1000;
  }
  return null;
}

function topFiveFromMap(map: Map<string, number>): RankedLabel[] {
  return [...map.entries()]
    .map(([label, count]) => ({ label: label || '—', count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export async function fetchSuperAdminGlobalStats(): Promise<SuperAdminGlobalStats> {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const [usersSnap, appointmentsSnap, reviewsSnap] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'appointments')),
    getDocs(collection(db, 'reviews')),
  ]);

  let usersEndUser = 0;
  let usersProfessional = 0;
  let usersSuperAdmin = 0;
  let friendEdgeSum = 0;
  let newUsersLast7Days = 0;
  const professionCounts = new Map<string, number>();
  const cityCounts = new Map<string, number>();
  let proSubscribedCount = 0;

  usersSnap.docs.forEach((d) => {
    const x = d.data() as Record<string, unknown>;
    const role = String(x.role ?? '');
    const friends = Array.isArray(x.friends) ? (x.friends as string[]) : [];
    friendEdgeSum += friends.length;

    if (role === 'user') usersEndUser += 1;
    else if (role === 'pro') {
      usersProfessional += 1;
      const status = x.accountStatus;
      const plan = x.subscriptionPlan;
      const subscribed =
        status === 'subscribed' ||
        (plan != null && plan !== '' && String(plan) !== 'null');
      if (subscribed) proSubscribedCount += 1;

      const profLabel =
        typeof x.profession === 'string' && x.profession.trim() !== ''
          ? x.profession.trim()
          : typeof x.professionId === 'string' && x.professionId.trim() !== ''
            ? x.professionId.trim()
            : 'Άγνωστο επάγγελμα';
      professionCounts.set(profLabel, (professionCounts.get(profLabel) ?? 0) + 1);

      const cityLabel =
        typeof x.city === 'string' && x.city.trim() !== ''
          ? x.city.trim()
          : typeof x.cityId === 'string' && x.cityId.trim() !== ''
            ? x.cityId.trim()
            : 'Άγνωστη πόλη';
      cityCounts.set(cityLabel, (cityCounts.get(cityLabel) ?? 0) + 1);
    } else if (role === 'superadmin') usersSuperAdmin += 1;

    const createdMs = timestampMs(x.createdAt);
    if (createdMs != null && createdMs >= sevenDaysAgo) {
      newUsersLast7Days += 1;
    }
  });

  let appointmentsTotal = 0;
  let appointmentsLast7Days = 0;
  appointmentsSnap.docs.forEach((d) => {
    appointmentsTotal += 1;
    const x = d.data() as Record<string, unknown>;
    const createdMs = timestampMs(x.createdAt);
    if (createdMs != null && createdMs >= sevenDaysAgo) appointmentsLast7Days += 1;
  });

  const reviewsTotal = reviewsSnap.size;

  return {
    usersEndUser,
    usersProfessional,
    usersSuperAdmin,
    friendConnectionsCount: Math.floor(friendEdgeSum / 2),
    appointmentsTotal,
    appointmentsLast7Days,
    reviewsTotal,
    newUsersLast7Days,
    topProfessions: topFiveFromMap(professionCounts),
    topCities: topFiveFromMap(cityCounts),
    proMembersTotal: usersProfessional,
    proSubscribedCount,
  };
}
