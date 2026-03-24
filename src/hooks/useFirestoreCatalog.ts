/**
 * Πόλεις και επαγγέλματα από Firestore με φίλτρο tenantId — ίδια λίστα με τη «Διαχείριση βάσης» του ηγέτη tenant.
 * Συνδεδεμένος χρήστης με tenantId: μόνο εγγραφές του tenant του. Super Admin χωρίς επιλεγμένο tenant: ευρύ query.
 * Πριν το login: ενσωματωμένο catalog (fallback εγγραφής).
 */
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../api';
import type { CityOption } from '../constants/data';
import { CITIES, PROFESSIONS } from '../constants/data';
import { useAuth } from '../context/AuthContext';
import { withTenantScope } from '../utils/tenantFirestore';
import type { CatalogProfession } from '../utils/catalogSearchIds';

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
  const [professionCatalog, setProfessionCatalog] = useState<CatalogProfession[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      if (!hasTenantDataAccess) {
        if (!user) {
          setCities(CITIES.map((c) => ({ ...c, firestoreId: undefined })));
          setProfessionCatalog(PROFESSIONS.map((name) => ({ id: name, name })));
        } else {
          setCities([]);
          setProfessionCatalog([]);
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
              firestoreId: d.id,
            };
          })
          .sort((a, b) => a.label.localeCompare(b.label, 'el'));
        setCities(list);
      } else {
        setCities([]);
      }

      if (profSnap && !profSnap.empty) {
        const plist: CatalogProfession[] = profSnap.docs
          .map((d) => {
            const x = d.data() as { name?: string };
            const name = (x.name ?? d.id).trim();
            return { id: d.id, name };
          })
          .filter((p) => p.name.length > 0)
          .sort((a, b) => a.name.localeCompare(b.name, 'el'));
        setProfessionCatalog(plist);
      } else {
        setProfessionCatalog([]);
      }
    } catch {
      if (!user) {
        setCities(CITIES.map((c) => ({ ...c, firestoreId: undefined })));
        setProfessionCatalog(PROFESSIONS.map((name) => ({ id: name, name })));
      } else {
        setCities([]);
        setProfessionCatalog([]);
      }
    } finally {
      setLoading(false);
    }
  }, [tenantId, isSuperAdmin, hasTenantDataAccess, user, catalogRefreshNonce]);

  useEffect(() => {
    if (authLoading) return;
    void reload();
  }, [reload, authLoading]);

  const cityLabels = cities.map((c) => c.label);
  const professions = professionCatalog.map((p) => p.name);

  return {
    cities,
    cityLabels,
    professions,
    professionCatalog,
    loading,
    reload,
  };
}
