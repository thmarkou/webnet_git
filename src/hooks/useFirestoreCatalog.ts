/**
 * Πόλεις και επαγγέλματα: Firestore cities / professions με φίλτρο tenantId.
 * Χωρίς συνδεδεμένο χρήστη: ενσωματωμένο catalog (εγγραφή πριν το login).
 */
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../api';
import type { CityOption } from '../constants/data';
import { CITIES, PROFESSIONS } from '../constants/data';
import { useAuth } from '../context/AuthContext';
import { withTenantScope } from '../utils/tenantFirestore';

export function useFirestoreCatalog() {
  const {
    tenantId,
    isSuperAdmin,
    hasTenantDataAccess,
    loading: authLoading,
    user,
    catalogRefreshNonce,
  } = useAuth();
  const [cities, setCities] = useState<CityOption[]>([]);
  const [professions, setProfessions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      if (!hasTenantDataAccess) {
        if (!user) {
          setCities([...CITIES]);
          setProfessions([...PROFESSIONS]);
        } else {
          setCities([]);
          setProfessions([]);
        }
        return;
      }

      const citiesRef = collection(db, 'cities');
      const profRef = collection(db, 'professions');
      const cityQ = withTenantScope(citiesRef, tenantId, isSuperAdmin);
      const profQ = withTenantScope(profRef, tenantId, isSuperAdmin);

      const [citySnap, profSnap] = await Promise.all([
        getDocs(cityQ).catch(() => null),
        getDocs(profQ).catch(() => null),
      ]);

      if (citySnap && !citySnap.empty) {
        const list = citySnap.docs
          .map((d) => {
            const x = d.data() as {
              name?: string;
              latitude?: number;
              longitude?: number;
              country?: string;
            };
            const label = (x.name ?? d.id).trim();
            return {
              label,
              latitude: typeof x.latitude === 'number' ? x.latitude : 37.9838,
              longitude: typeof x.longitude === 'number' ? x.longitude : 23.7275,
              country: x.country ?? 'Ελλάδα',
            };
          })
          .sort((a, b) => a.label.localeCompare(b.label, 'el'));
        setCities(list);
      } else {
        setCities(hasTenantDataAccess ? [] : [...CITIES]);
      }

      if (profSnap && !profSnap.empty) {
        setProfessions(
          profSnap.docs
            .map((d) => {
              const x = d.data() as { name?: string };
              return (x.name ?? d.id).trim();
            })
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, 'el'))
        );
      } else {
        setProfessions(hasTenantDataAccess ? [] : [...PROFESSIONS]);
      }
    } catch {
      setCities(!user ? [...CITIES] : []);
      setProfessions(!user ? [...PROFESSIONS] : []);
    } finally {
      setLoading(false);
    }
  }, [tenantId, isSuperAdmin, hasTenantDataAccess, user, catalogRefreshNonce]);

  useEffect(() => {
    if (authLoading) return;
    void reload();
  }, [reload, authLoading]);

  const cityLabels = cities.map((c) => c.label);

  return { cities, cityLabels, professions, loading, reload };
}
