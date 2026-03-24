/**
 * Διαχείριση βάσης (tenant): CRUD πόλεις / επαγγέλματα με tenantId — για ηγέτη ομάδας (Tenant Admin) και Super Admin.
 * Φίλτρο ανά tenant: κάθε ομάδα βλέπει μόνο δικά της δεδομένα. Διπλότυπα μπλοκάρονται· διαγραφή πόλης/επαγγέλματος
 * μπλοκάρεται αν χρησιμοποιείται από επαγγελματίες (users pro + importedProfessionals) του ίδιου tenant.
 * Merge από ενσωματωμένο catalog, Excel import (ίδια πεδία με καταχώρηση επαγγελματία + geocode).
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import * as XLSX from 'xlsx';
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
  Timestamp,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db } from '../api';
import { CITIES, PROFESSIONS, type CityOption } from '../constants/data';
import { FormSelect } from '../components/FormSelect';
import { isValidGreekPhone } from '../utils/phoneValidation';
import { parseServicePriceBasisFromImport } from '../utils/servicePricing';

type TabKey = 'cities' | 'professions' | 'bulk';

type CityRow = {
  id: string;
  name: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  tenantId?: string;
};
type ProfRow = { id: string; name: string };

type ExcelRow = {
  firstName: string;
  lastName: string;
  businessName: string;
  email: string;
  phone: string;
  vat: string;
  profession: string;
  city: string;
  country: string;
  address: string;
  addressNumber: string;
  area: string;
  zip: string;
  website: string;
  bio: string;
  serviceName: string;
  serviceDesc: string;
  servicePriceBasis: string;
  servicePrice: string;
  serviceTimeEstimate: string;
  profileDisplayType: string;
};

function excelEmailValid(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

function buildImportGeocodeQuery(parts: {
  address: string;
  addressNumber: string;
  zip: string;
  area: string;
  city: string;
  country: string;
}): { primary: string; fallback: string } {
  const streetLine = [parts.address.trim(), parts.addressNumber.trim()].filter(Boolean).join(' ').trim();
  const locality = [parts.zip.trim(), parts.area.trim(), parts.city.trim()].filter(Boolean).join(', ');
  const country = parts.country.trim() || 'Ελλάδα';
  const primary =
    country === 'Ελλάδα'
      ? `${streetLine}, ${locality}, Greece`
      : `${streetLine}, ${locality}, ${country}`;
  const fallback = `${streetLine}, ${parts.city.trim()}, Greece`;
  return { primary, fallback };
}

type GeocodeFailure = { row: number; query: string; reason: string };

const GEOCODE_STAGGER_MS = 400;
const CITY_MAP_DELTA = { latitudeDelta: 0.08, longitudeDelta: 0.08 };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Case-insensitive σύγκριση ονόματος πόλης / επαγγέλματος. */
function normalizeEntryName(s: string): string {
  return s.trim().toLowerCase();
}

/** Πόσοι επαγγελματίες (users role pro + imported) στον tenant έχουν αυτή την πόλη στο πεδίο city. */
async function countProsReferencingCity(tenantId: string, cityDisplayName: string): Promise<number> {
  const target = normalizeEntryName(cityDisplayName);
  if (!target) return 0;
  let n = 0;
  const uSnap = await getDocs(query(collection(db, 'users'), where('tenantId', '==', tenantId)));
  for (const d of uSnap.docs) {
    const x = d.data() as { role?: string; city?: string };
    if (x.role !== 'pro') continue;
    if (normalizeEntryName(String(x.city ?? '')) === target) n += 1;
  }
  const iSnap = await getDocs(
    query(collection(db, 'importedProfessionals'), where('tenantId', '==', tenantId))
  );
  for (const d of iSnap.docs) {
    const x = d.data() as { city?: string };
    if (normalizeEntryName(String(x.city ?? '')) === target) n += 1;
  }
  return n;
}

/** Πόσοι επαγγελματίες στον tenant έχουν αυτό το επάγγελμα (κείμενο profession). */
async function countProsReferencingProfession(
  tenantId: string,
  professionDisplayName: string
): Promise<number> {
  const target = normalizeEntryName(professionDisplayName);
  if (!target) return 0;
  let n = 0;
  const uSnap = await getDocs(query(collection(db, 'users'), where('tenantId', '==', tenantId)));
  for (const d of uSnap.docs) {
    const x = d.data() as { role?: string; profession?: string };
    if (x.role !== 'pro') continue;
    if (normalizeEntryName(String(x.profession ?? '')) === target) n += 1;
  }
  const iSnap = await getDocs(
    query(collection(db, 'importedProfessionals'), where('tenantId', '==', tenantId))
  );
  for (const d of iSnap.docs) {
    const x = d.data() as { profession?: string };
    if (normalizeEntryName(String(x.profession ?? '')) === target) n += 1;
  }
  return n;
}

function slugForCatalogCityLabel(label: string): string {
  return label.replace(/\s+/g, '_').slice(0, 120);
}

/** Geocode ανά πόλη από το ενσωματωμένο catalog — fallback στα στατικά lat/lng. */
async function coordsForCatalogCity(c: CityOption): Promise<{
  latitude: number;
  longitude: number;
}> {
  const queries = [`${c.label}, ${c.country}`, `${c.label}, Greece`];
  for (const q of queries) {
    try {
      const results = await Location.geocodeAsync(q);
      if (results?.length) {
        const hit = results[0];
        return { latitude: hit.latitude, longitude: hit.longitude };
      }
    } catch {
      /* fallback */
    }
  }
  return { latitude: c.latitude, longitude: c.longitude };
}

function normalizeRowKeys(r: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(r).map(([k, v]) => [String(k).trim().toLowerCase(), v])
  );
}

function pickCell(row: Record<string, unknown>, ...names: string[]): string {
  const n = normalizeRowKeys(row);
  for (const key of names) {
    const v = n[key.toLowerCase()];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

type TenantPickRow = { tenantId: string; displayName: string };

function tenantOptionLabel(r: TenantPickRow): string {
  return `${r.displayName} (${r.tenantId})`;
}

function parseTenantIdFromOption(label: string): string {
  const m = label.match(/\(([^)]+)\)\s*$/);
  return m ? m[1].trim() : '';
}

export default function AdminDashboardScreen() {
  const { isSuperAdmin, tenantId: authTenantId, canAccessAdminDashboard, refreshFirestoreCatalog } =
    useAuth();
  const [tab, setTab] = useState<TabKey>('cities');
  const [tenantRows, setTenantRows] = useState<TenantPickRow[]>([]);
  const [adminScopeTenantId, setAdminScopeTenantId] = useState('');
  const [cities, setCities] = useState<CityRow[]>([]);
  const [professions, setProfessions] = useState<ProfRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [cityName, setCityName] = useState('');
  const [cityCountry, setCityCountry] = useState('Ελλάδα');
  const [editingCityId, setEditingCityId] = useState<string | null>(null);
  const [cityVerifiedCoords, setCityVerifiedCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [cityGeocodePending, setCityGeocodePending] = useState(false);

  const [profName, setProfName] = useState('');
  const [editingProfId, setEditingProfId] = useState<string | null>(null);

  const [importRunning, setImportRunning] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [importFailures, setImportFailures] = useState<GeocodeFailure[]>([]);
  const [failuresModalVisible, setFailuresModalVisible] = useState(false);
  const [adminGuideOpen, setAdminGuideOpen] = useState(true);
  /** Εμφανιζόμενο όνομα ομάδας για Tenant Admin (από tenants). */
  const [tenantDisplayLabel, setTenantDisplayLabel] = useState('');

  const effectiveTenantId = isSuperAdmin ? adminScopeTenantId : (authTenantId ?? '');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      if (!effectiveTenantId) {
        setCities([]);
        setProfessions([]);
        return;
      }
      const [cSnap, pSnap] = await Promise.all([
        getDocs(query(collection(db, 'cities'), where('tenantId', '==', effectiveTenantId))),
        getDocs(query(collection(db, 'professions'), where('tenantId', '==', effectiveTenantId))),
      ]);
      setCities(
        cSnap.docs
          .map((d) => {
            const x = d.data() as CityRow;
            return {
              id: d.id,
              name: x.name ?? d.id,
              latitude: typeof x.latitude === 'number' ? x.latitude : undefined,
              longitude: typeof x.longitude === 'number' ? x.longitude : undefined,
              country: x.country,
              tenantId: typeof x.tenantId === 'string' ? x.tenantId : undefined,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name, 'el'))
      );
      setProfessions(
        pSnap.docs
          .map((d) => {
            const x = d.data() as { name?: string };
            return {
              id: d.id,
              name: x.name ?? d.id,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name, 'el'))
      );
    } catch (e) {
      Alert.alert('Σφάλμα', e instanceof Error ? e.message : 'Firestore');
    } finally {
      setLoading(false);
    }
  }, [effectiveTenantId]);

  useEffect(() => {
    if (!isSuperAdmin && authTenantId) {
      setAdminScopeTenantId(authTenantId);
    }
  }, [isSuperAdmin, authTenantId]);

  useEffect(() => {
    if (isSuperAdmin || !authTenantId) {
      setTenantDisplayLabel('');
      return;
    }
    void (async () => {
      try {
        const tq = query(
          collection(db, 'tenants'),
          where('tenantId', '==', authTenantId),
          limit(1)
        );
        const s = await getDocs(tq);
        const x = s.docs[0]?.data() as { displayName?: string; name?: string } | undefined;
        const label = String(x?.displayName ?? x?.name ?? '').trim();
        setTenantDisplayLabel(label || authTenantId);
      } catch {
        setTenantDisplayLabel(authTenantId);
      }
    })();
  }, [isSuperAdmin, authTenantId]);

  useEffect(() => {
    if (!isSuperAdmin || !canAccessAdminDashboard) return;
    void (async () => {
      try {
        const snap = await getDocs(collection(db, 'tenants'));
        const rows: TenantPickRow[] = snap.docs.map((d) => {
          const x = d.data() as { tenantId?: string; displayName?: string; name?: string };
          const tid = String(x.tenantId ?? d.id);
          return { tenantId: tid, displayName: String(x.displayName ?? x.name ?? tid) };
        });
        setTenantRows(rows);
        setAdminScopeTenantId((prev) => {
          if (prev && rows.some((r) => r.tenantId === prev)) return prev;
          if (rows[0]?.tenantId) return rows[0].tenantId;
          if (authTenantId) return authTenantId;
          return '';
        });
      } catch {
        setTenantRows([]);
        if (authTenantId) setAdminScopeTenantId(authTenantId);
      }
    })();
  }, [isSuperAdmin, canAccessAdminDashboard, authTenantId]);

  useEffect(() => {
    if (canAccessAdminDashboard) void loadAll();
  }, [canAccessAdminDashboard, loadAll]);

  const cityMapRegion = useMemo(() => {
    if (cityVerifiedCoords) {
      return {
        latitude: cityVerifiedCoords.latitude,
        longitude: cityVerifiedCoords.longitude,
        ...CITY_MAP_DELTA,
      };
    }
    return {
      latitude: 39.0742,
      longitude: 21.8243,
      latitudeDelta: 4,
      longitudeDelta: 4,
    };
  }, [cityVerifiedCoords]);

  const isDuplicateCityName = useCallback(
    (name: string, excludeId: string | null) => {
      const n = normalizeEntryName(name);
      if (!n) return false;
      return cities.some(
        (c) => c.id !== excludeId && normalizeEntryName(c.name) === n
      );
    },
    [cities]
  );

  const isDuplicateProfName = useCallback(
    (name: string, excludeId: string | null) => {
      const n = normalizeEntryName(name);
      if (!n) return false;
      return professions.some(
        (p) => p.id !== excludeId && normalizeEntryName(p.name) === n
      );
    },
    [professions]
  );

  const citySuggestions = useMemo(() => {
    const q = cityName.trim().toLowerCase();
    if (q.length < 1) return [] as CityRow[];
    return cities
      .filter((c) => c.id !== editingCityId && c.name.toLowerCase().includes(q))
      .slice(0, 10);
  }, [cities, cityName, editingCityId]);

  const profSuggestions = useMemo(() => {
    const q = profName.trim().toLowerCase();
    if (q.length < 1) return [] as ProfRow[];
    return professions
      .filter((p) => p.id !== editingProfId && p.name.toLowerCase().includes(q))
      .slice(0, 10);
  }, [professions, profName, editingProfId]);

  if (!canAccessAdminDashboard) {
    return (
      <View style={styles.centered}>
        <Text style={styles.warn}>Δεν έχεις δικαίωμα πρόσβασης σε αυτή την οθόνη.</Text>
      </View>
    );
  }

  const requireWriteTenant = (): string | null => {
    if (!effectiveTenantId) {
      Alert.alert(
        'Tenant',
        isSuperAdmin
          ? 'Επίλεξε ομάδα (tenant) από τη λίστα παραπάνω ή δημιούργησε tenant από το Super Admin.'
          : 'Το προφίλ σου δεν έχει tenantId — χωρίς αυτό δεν μπορείς να αποθηκεύσεις πόλεις/επαγγέλματα για την ομάδα σου. Επικοινώνησε με τον διαχειριστή της πλατφόρμας.'
      );
      return null;
    }
    return effectiveTenantId;
  };

  const clearCityForm = () => {
    setCityName('');
    setCityCountry('Ελλάδα');
    setEditingCityId(null);
    setCityVerifiedCoords(null);
  };

  const verifyCity = async () => {
    const name = cityName.trim();
    if (!name) {
      Alert.alert('Όνομα πόλης', 'Συμπλήρωσε το όνομα της πόλης.');
      return;
    }
    setCityGeocodePending(true);
    try {
      const country = cityCountry.trim() || 'Ελλάδα';
      const queries = [`${name}, ${country}`, `${name}, Greece`];
      let hit: Location.LocationGeocodedLocation | null = null;
      for (const q of queries) {
        const results = await Location.geocodeAsync(q);
        if (results?.length) {
          hit = results[0];
          break;
        }
      }
      if (!hit) {
        Alert.alert('Δεν βρέθηκε', 'Δοκίμασε άλλο όνομα ή χώρα.');
        setCityVerifiedCoords(null);
        return;
      }
      setCityVerifiedCoords({ latitude: hit.latitude, longitude: hit.longitude });
    } catch (e) {
      Alert.alert('Geocoding', e instanceof Error ? e.message : 'Σφάλμα');
      setCityVerifiedCoords(null);
    } finally {
      setCityGeocodePending(false);
    }
  };

  const saveCity = async () => {
    const name = cityName.trim();
    if (!name) {
      Alert.alert('Συμπλήρωσε όνομα πόλης.');
      return;
    }
    if (!cityVerifiedCoords) {
      Alert.alert('Επαλήθευση', 'Πάτα «Επαλήθευση» και επιβεβαίωσε τη θέση στον χάρτη πριν την αποθήκευση.');
      return;
    }
    const tid = requireWriteTenant();
    if (!tid) return;

    if (isDuplicateCityName(name, editingCityId)) {
      Alert.alert(
        'Διπλότυπο',
        'Υπάρχει ήδη πόλη με αυτό το όνομα για την ομάδα σου (ίδιο όνομα, χωρίς διάκριση πεζών/κεφαλαίων).'
      );
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name,
        latitude: cityVerifiedCoords.latitude,
        longitude: cityVerifiedCoords.longitude,
        country: cityCountry.trim() || 'Ελλάδα',
        tenantId: tid,
      };
      if (editingCityId) {
        await updateDoc(doc(db, 'cities', editingCityId), payload);
      } else {
        await addDoc(collection(db, 'cities'), payload);
      }
      clearCityForm();
      await loadAll();
      refreshFirestoreCatalog();
    } catch (e) {
      Alert.alert('Σφάλμα', e instanceof Error ? e.message : '');
    } finally {
      setLoading(false);
    }
  };

  const startEditCity = (c: CityRow) => {
    setEditingCityId(c.id);
    setCityName(c.name);
    setCityCountry(c.country ?? 'Ελλάδα');
    if (
      typeof c.latitude === 'number' &&
      typeof c.longitude === 'number' &&
      Number.isFinite(c.latitude) &&
      Number.isFinite(c.longitude)
    ) {
      setCityVerifiedCoords({ latitude: c.latitude, longitude: c.longitude });
    } else {
      setCityVerifiedCoords(null);
    }
  };

  const removeCity = (id: string) => {
    const row = cities.find((c) => c.id === id);
    if (!row) return;
    const tid = effectiveTenantId;
    if (!tid) {
      requireWriteTenant();
      return;
    }
    if (row.tenantId && row.tenantId !== tid) {
      Alert.alert('Έλεγχος', 'Η εγγραφή δεν ανήκει στον tenant που διαχειρίζεσαι τώρα.');
      return;
    }
    Alert.alert('Διαγραφή πόλης;', `Θα διαγραφεί η «${row.name}».`, [
      { text: 'Άκυρο', style: 'cancel' },
      {
        text: 'Διαγραφή',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setLoading(true);
            try {
              const used = await countProsReferencingCity(tid, row.name);
              if (used > 0) {
                Alert.alert(
                  'Δεν επιτρέπεται',
                  `Η πόλη «${row.name}» χρησιμοποιείται από ${used} επαγγελματία (ή εγγραφή εισαγωγής). Άλλαξε πρώτα την πόλη στα προφίλ τους ή αφαίρεσέ τους.`
                );
                return;
              }
              await deleteDoc(doc(db, 'cities', id));
              await loadAll();
              refreshFirestoreCatalog();
            } catch (e) {
              Alert.alert('Σφάλμα', e instanceof Error ? e.message : '');
            } finally {
              setLoading(false);
            }
          })();
        },
      },
    ]);
  };

  const clearProfForm = () => {
    setProfName('');
    setEditingProfId(null);
  };

  const saveProfession = async () => {
    const name = profName.trim();
    if (!name) {
      Alert.alert('Συμπλήρωσε επάγγελμα.');
      return;
    }
    const tid = requireWriteTenant();
    if (!tid) return;

    if (isDuplicateProfName(name, editingProfId)) {
      Alert.alert(
        'Διπλότυπο',
        'Υπάρχει ήδη επάγγελμα με αυτό το όνομα για την ομάδα σου (ίδιο όνομα, χωρίς διάκριση πεζών/κεφαλαίων).'
      );
      return;
    }

    setLoading(true);
    try {
      if (editingProfId) {
        await updateDoc(doc(db, 'professions', editingProfId), { name, tenantId: tid });
      } else {
        await addDoc(collection(db, 'professions'), { name, tenantId: tid });
      }
      clearProfForm();
      await loadAll();
      refreshFirestoreCatalog();
    } catch (e) {
      Alert.alert('Σφάλμα', e instanceof Error ? e.message : '');
    } finally {
      setLoading(false);
    }
  };

  const removeProfession = (id: string) => {
    const row = professions.find((p) => p.id === id);
    if (!row) return;
    const tid = effectiveTenantId;
    if (!tid) {
      requireWriteTenant();
      return;
    }
    Alert.alert('Διαγραφή επαγγέλματος;', `Θα διαγραφεί το «${row.name}».`, [
      { text: 'Άκυρο', style: 'cancel' },
      {
        text: 'Διαγραφή',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setLoading(true);
            try {
              const used = await countProsReferencingProfession(tid, row.name);
              if (used > 0) {
                Alert.alert(
                  'Δεν επιτρέπεται',
                  `Το επάγγελμα «${row.name}» χρησιμοποιείται από ${used} επαγγελματία (ή εγγραφή εισαγωγής). Άλλαξε πρώτα το επάγγελμα στα προφίλ τους ή αφαίρεσέ τους.`
                );
                return;
              }
              await deleteDoc(doc(db, 'professions', id));
              await loadAll();
              refreshFirestoreCatalog();
            } catch (e) {
              Alert.alert('Σφάλμα', e instanceof Error ? e.message : '');
            } finally {
              setLoading(false);
            }
          })();
        },
      },
    ]);
  };

  type CatalogMergeScope = 'cities' | 'professions';

  const seedEmbeddedCatalog = async (scope: CatalogMergeScope) => {
    const tid = requireWriteTenant();
    if (!tid) return;

    setLoading(true);
    try {
      const [cSnapExist, pSnapExist] = await Promise.all([
        getDocs(query(collection(db, 'cities'), where('tenantId', '==', tid))),
        getDocs(query(collection(db, 'professions'), where('tenantId', '==', tid))),
      ]);
      const existingCityNorm = new Set(
        cSnapExist.docs
          .map((d) =>
            normalizeEntryName(String((d.data() as { name?: string }).name ?? ''))
          )
          .filter((n) => n.length > 0)
      );
      const existingProfNorm = new Set(
        pSnapExist.docs
          .map((d) =>
            normalizeEntryName(String((d.data() as { name?: string }).name ?? ''))
          )
          .filter((n) => n.length > 0)
      );

      let cityAdded = 0;
      let citySkipped = 0;
      let profAdded = 0;
      let profSkipped = 0;

      if (scope === 'cities') {
        for (let i = 0; i < CITIES.length; i++) {
          const c = CITIES[i];
          const norm = normalizeEntryName(c.label);
          if (existingCityNorm.has(norm)) {
            citySkipped += 1;
            continue;
          }
          existingCityNorm.add(norm);
          await sleep(GEOCODE_STAGGER_MS);
          const { latitude, longitude } = await coordsForCatalogCity(c);
          const id = `${tid}_${slugForCatalogCityLabel(c.label)}`;
          await setDoc(
            doc(db, 'cities', id),
            {
              name: c.label,
              latitude,
              longitude,
              country: c.country,
              tenantId: tid,
            },
            { merge: true }
          );
          cityAdded += 1;
        }
      } else {
        for (let i = 0; i < PROFESSIONS.length; i++) {
          const p = PROFESSIONS[i];
          const norm = normalizeEntryName(p);
          if (existingProfNorm.has(norm)) {
            profSkipped += 1;
            continue;
          }
          existingProfNorm.add(norm);
          await addDoc(collection(db, 'professions'), { name: p, tenantId: tid });
          profAdded += 1;
        }
      }

      await loadAll();
      refreshFirestoreCatalog();
      const msg =
        scope === 'cities'
          ? `Πόλεις: +${cityAdded} νέες (παράβλεψη ${citySkipped} υπαρχουσών).`
          : `Επαγγέλματα: +${profAdded} νέα (παράβλεψη ${profSkipped} υπαρχόντων).`;
      Alert.alert('OK', msg);
    } catch (e) {
      Alert.alert('Σφάλμα', e instanceof Error ? e.message : '');
    } finally {
      setLoading(false);
    }
  };

  const parseExcelRows = (sheet: XLSX.WorkSheet): ExcelRow[] => {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    return rows.map((row) => {
      const explicitBusiness = pickCell(
        row,
        'businessname',
        'επωνυμία',
        'επωνυμια',
        'company',
        'tradename'
      );
      const legacyEnglishName = pickCell(row, 'name');
      const onomaGr = pickCell(row, 'όνομα');
      const firstFromCols = pickCell(row, 'firstname', 'first_name', 'fname', 'first name');
      const lastFromCols = pickCell(row, 'lastname', 'last_name', 'lname', 'surname', 'επώνυμο', 'επωνυμο');

      let firstName = firstFromCols;
      let lastName = lastFromCols;
      let businessName = explicitBusiness || legacyEnglishName;

      /* Παλιό template: μία στήλη «Όνομα» = επωνυμία. Νέο: Όνομα + Επώνυμο + Επωνυμία. */
      if (!firstFromCols && onomaGr) {
        if (explicitBusiness || legacyEnglishName || lastFromCols) {
          firstName = onomaGr;
        } else {
          businessName = businessName || onomaGr;
        }
      }

      return {
        firstName,
        lastName,
        businessName,
        email: pickCell(row, 'email', 'e-mail'),
        phone: pickCell(row, 'phone', 'τηλέφωνο', 'τηλεφωνο', 'tel', 'mobile', 'κινητό', 'κινητο'),
        vat: pickCell(row, 'vat', 'αφμ', 'afm', 'taxid', 'tax_id'),
        profession: pickCell(row, 'profession', 'category', 'επάγγελμα', 'επαγγελμα'),
        city: pickCell(row, 'city', 'πόλη', 'poli'),
        country: pickCell(row, 'country', 'χώρα', 'χωρα') || 'Ελλάδα',
        address: pickCell(row, 'address', 'διεύθυνση', 'διευθυνση', 'street', 'οδός', 'οδος'),
        addressNumber: pickCell(row, 'addressnumber', 'αριθμός', 'αριθμος', 'number', 'no', 'streetnumber'),
        area: pickCell(row, 'area', 'περιοχή', 'περιοχη', 'district'),
        zip: pickCell(row, 'zip', 'postalcode', 'postcode', 'τκ', 'tk', 'ταχυδρομικός', 'ταχυδρομικος'),
        website: pickCell(row, 'website', 'url', 'ιστότοπος', 'ιστοτοπος'),
        bio: pickCell(row, 'bio', 'περιγραφή', 'περιγραφη', 'description'),
        serviceName: pickCell(row, 'servicename', 'service_name', 'υπηρεσία', 'υπηρεσια', 'όνομα υπηρεσίας'),
        serviceDesc: pickCell(row, 'servicedesc', 'service_description', 'περιγραφή υπηρεσίας'),
        servicePriceBasis: pickCell(row, 'servicepricebasis', 'pricebasis', 'τιμολόγηση', 'τιμολογηση'),
        servicePrice: pickCell(row, 'serviceprice', 'τιμή', 'τιμη', 'price'),
        serviceTimeEstimate: pickCell(
          row,
          'servicetimeestimate',
          'timeestimate',
          'χρόνος',
          'χρονος',
          'duration'
        ),
        profileDisplayType: pickCell(
          row,
          'profiledisplaytype',
          'τύπος προφίλ',
          'τυπος προφιλ',
          'profile_type'
        ),
      };
    });
  };

  const runExcelImport = async (rows: ExcelRow[]) => {
    const tid = requireWriteTenant();
    if (!tid) return;

    setImportFailures([]);
    setImportRunning(true);
    let saved = 0;
    const failures: GeocodeFailure[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const sheetRow = i + 2;
      setImportProgress(`${i + 1} / ${rows.length}`);

      let firstName = row.firstName.trim();
      let lastName = row.lastName.trim();
      const businessName = row.businessName.trim();
      const email = row.email.trim();
      const phone = row.phone.trim();
      const vatDigits = row.vat.replace(/\D/g, '');
      const profession = row.profession.trim();
      const city = row.city.trim();
      const country = row.country.trim() || 'Ελλάδα';
      const address = row.address.trim();
      const addressNumber = row.addressNumber.trim();
      const area = row.area.trim();
      const zip = row.zip.trim();

      if (!businessName) {
        failures.push({ row: sheetRow, query: '', reason: 'Κενή επωνυμία (businessName / Name)' });
        continue;
      }

      if (!firstName && !lastName) {
        const tokens = businessName.split(/\s+/).filter(Boolean);
        firstName = tokens[0] ?? '';
        lastName = tokens.length > 1 ? tokens.slice(1).join(' ') : '';
      }

      if (!firstName.trim() || !lastName.trim()) {
        failures.push({
          row: sheetRow,
          query: '',
          reason: 'Όνομα και επώνυμο: συμπλήρωσε firstName/lastName ή επωνυμία με 2+ λέξεις',
        });
        continue;
      }

      if (vatDigits.length !== 9) {
        failures.push({ row: sheetRow, query: '', reason: 'ΑΦΜ: απαιτούνται 9 ψηφία' });
        continue;
      }

      if (!address || !addressNumber || !zip) {
        failures.push({
          row: sheetRow,
          query: '',
          reason: 'Υποχρεωτικά: Οδός (address), Αριθμός (addressNumber), ΤΚ (zip)',
        });
        continue;
      }

      if (!profession) {
        failures.push({ row: sheetRow, query: '', reason: 'Κενό επάγγελμα' });
        continue;
      }

      if (!city) {
        failures.push({ row: sheetRow, query: '', reason: 'Κενή πόλη' });
        continue;
      }

      if (!phone || !isValidGreekPhone(phone)) {
        failures.push({
          row: sheetRow,
          query: '',
          reason: 'Μη έγκυρο τηλέφωνο (π.χ. κινητό 69xxxxxxxx)',
        });
        continue;
      }

      if (email && !excelEmailValid(email)) {
        failures.push({ row: sheetRow, query: '', reason: 'Μη έγκυρο email' });
        continue;
      }

      const { primary, fallback } = buildImportGeocodeQuery({
        address,
        addressNumber,
        zip,
        area,
        city,
        country,
      });
      if (!primary || primary === 'Greece' || primary.startsWith(', ')) {
        failures.push({
          row: sheetRow,
          query: primary,
          reason: 'Κενή ή ανεπαρκής διεύθυνση για geocode',
        });
        continue;
      }

      await sleep(GEOCODE_STAGGER_MS);

      try {
        let geo = await Location.geocodeAsync(primary);
        if (!geo?.length) {
          geo = await Location.geocodeAsync(fallback);
        }
        if (!geo?.length) {
          failures.push({ row: sheetRow, query: primary, reason: 'Δεν βρέθηκε συντεταγμένη' });
          continue;
        }
        const { latitude, longitude } = geo[0];
        const priceParsed = parseFloat(row.servicePrice.replace(',', '.'));
        const servicePrice = Number.isFinite(priceParsed) ? priceParsed : 0;
        const basis = parseServicePriceBasisFromImport(row.servicePriceBasis);

        await addDoc(collection(db, 'importedProfessionals'), {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          businessName,
          email,
          phone,
          vat: vatDigits,
          profession,
          city,
          country,
          address,
          addressNumber,
          area,
          zip,
          website: row.website.trim(),
          bio: row.bio.trim(),
          serviceName: row.serviceName.trim(),
          serviceDesc: row.serviceDesc.trim(),
          servicePriceBasis: basis,
          servicePrice,
          serviceTimeEstimate: row.serviceTimeEstimate.trim(),
          profileDisplayType: row.profileDisplayType.trim() || 'male',
          latitude,
          longitude,
          tenantId: tid,
          importedAt: Timestamp.now(),
          source: 'excel_geocode',
        });
        saved += 1;
      } catch (e) {
        failures.push({
          row: sheetRow,
          query: primary,
          reason: e instanceof Error ? e.message : 'Σφάλμα αποθήκευσης/geocode',
        });
      }
    }

    setImportRunning(false);
    setImportProgress('');
    setImportFailures(failures);
    await loadAll();

    const msg =
      failures.length === 0
        ? `Αποθηκεύτηκαν ${saved} επαγγελματίες.`
        : `Αποθηκεύτηκαν ${saved}. Αποτυχίες: ${failures.length}.`;

    Alert.alert('Ολοκλήρωση import', msg, [
      ...(failures.length
        ? [
            {
              text: 'Λίστα αποτυχιών',
              onPress: () => setFailuresModalVisible(true),
            },
          ]
        : []),
      { text: 'OK' },
    ]);
  };

  const pickExcel = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;

      const uri = res.assets[0].uri;
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const wb = XLSX.read(b64, { type: 'base64' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const parsed = parseExcelRows(sheet);

      if (parsed.length === 0) {
        Alert.alert('Άδειο αρχείο', 'Δεν βρέθηκαν γραμμές δεδομένων.');
        return;
      }

      Alert.alert(
        'Επιβεβαίωση',
        `Βρέθηκαν ${parsed.length} γραμμές. Έλεγχος πεδίων όπως στην καταχώρηση επαγγελματία + geocode (οδός, αριθμός, ΤΚ, πόλη). Μπορεί να πάρει λίγα λεπτά. Συνέχεια;`,
        [
          { text: 'Άκυρο', style: 'cancel' },
          { text: 'Έναρξη', onPress: () => void runExcelImport(parsed) },
        ]
      );
    } catch (e) {
      Alert.alert('Σφάλμα', e instanceof Error ? e.message : '');
    }
  };

  const renderCityTableHeader = () => (
    <View style={styles.tableHeader}>
      <Text style={[styles.th, styles.thName]}>Πόλη</Text>
      <Text style={[styles.th, styles.thCoord]}>Συντετ.</Text>
      <Text style={[styles.th, styles.thActions]} />
    </View>
  );

  const renderProfTableHeader = () => (
    <View style={styles.tableHeader}>
      <Text style={[styles.th, styles.thName]}>Επάγγελμα</Text>
      <Text style={[styles.th, styles.thActions]} />
    </View>
  );

  const tenantPicker =
    isSuperAdmin && tenantRows.length > 0 ? (
      <View style={styles.tenantPickerWrap}>
        <FormSelect
          label="Tenant (λειτουργίες Admin)"
          value={
            tenantRows.find((r) => r.tenantId === adminScopeTenantId)
              ? tenantOptionLabel(tenantRows.find((r) => r.tenantId === adminScopeTenantId)!)
              : ''
          }
          options={tenantRows.map(tenantOptionLabel)}
          onChange={(label) => setAdminScopeTenantId(parseTenantIdFromOption(label))}
          placeholder="Επίλεξε tenant"
        />
        <Text style={styles.tenantHint}>
          Ως διαχειριστής πλατφόρμας (Super Admin), επίλεξε ποια ομάδα (tenant) θα επεξεργαστείς· οι πόλεις και τα
          επαγγέλματα είναι ξεχωριστά ανά tenant.
        </Text>
      </View>
    ) : isSuperAdmin && tenantRows.length === 0 ? (
      <View style={styles.tenantPickerWrap}>
        <Text style={styles.tenantHint}>
          {authTenantId
            ? `Χρήση tenantId από προφίλ: ${authTenantId}. Γέμισμα catalog παρακάτω ισχύει γι’ αυτόν τον tenant.`
            : 'Δεν υπάρχουν tenants. Δημιούργησε έναν από το Super Admin Dashboard.'}
        </Text>
      </View>
    ) : null;

  return (
    <View style={styles.root}>
      {tenantPicker}
      {!isSuperAdmin && canAccessAdminDashboard ? (
        <View style={styles.tenantLeaderBanner}>
          <Text style={styles.tenantLeaderTitle}>Διαχείριση βάσης για την ομάδα σου</Text>
          <Text style={styles.tenantLeaderBody}>
            Πρόσθεσε ή άλλαξε πόλεις και επαγγέλματα· εμφανίζονται μόνο στα dropdowns χρηστών και επαγγελματιών με το
            ίδιο tenantId. Άλλες ομάδες δεν βλέπουν τα δεδομένα σου.
          </Text>
          {effectiveTenantId ? (
            <Text style={styles.tenantLeaderMono} selectable>
              {tenantDisplayLabel ? `Ομάδα: ${tenantDisplayLabel}\n` : ''}tenantId: {effectiveTenantId}
            </Text>
          ) : (
            <Text style={styles.warnInline}>
              Λείπει tenantId στο προφίλ — επικοινώνησε με τον διαχειριστή της πλατφόρμας.
            </Text>
          )}
        </View>
      ) : null}
      <View style={styles.adminGuideCard}>
        <TouchableOpacity
          style={styles.adminGuideHeader}
          onPress={() => setAdminGuideOpen((o) => !o)}
          accessibilityRole="button"
        >
          <Text style={styles.adminGuideTitle}>Βοήθεια (πολύ απλά βήματα)</Text>
          <Text style={styles.adminGuideToggle}>{adminGuideOpen ? '▼' : '▶'}</Text>
        </TouchableOpacity>
        {adminGuideOpen ? (
          <View style={styles.adminGuideBody}>
            <Text style={styles.adminGuideStep}>
              <Text style={styles.adminGuideNum}>1. </Text>
              Αν είσαι ηγέτης ομάδας (Tenant Admin), δουλεύεις αυτόματα για τον tenantId του προφίλ σου. Αν είσαι Super
              Admin, επίλεξε πρώτα την ομάδα από τη λίστα πάνω.
            </Text>
            <Text style={styles.adminGuideStep}>
              <Text style={styles.adminGuideNum}>2. </Text>
              Καρτέλα «Πόλεις»: πρόσθεσε χειροκίνητα (επαλήθευση + χάρτης) ή χρησιμοποίησε merge από ενσωματωμένο
              catalog — μόνο νέα ονόματα, χωρίς διπλότυπα.
            </Text>
            <Text style={styles.adminGuideStep}>
              <Text style={styles.adminGuideNum}>3. </Text>
              Καρτέλα «Επαγγέλματα»: ίδια λογική· τα dropdowns εγγραφής επαγγελματία τραβάνε μόνο τις εγγραφές του tenant
              σου.
            </Text>
            <Text style={styles.adminGuideStep}>
              <Text style={styles.adminGuideNum}>4. </Text>
              Δεν μπορείς να σβήσεις πόλη ή επάγγελμα αν το χρησιμοποιεί ήδη επαγγελματίας της ομάδας σου — άλλαξε πρώτα
              τα προφίλ.
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.tabs}>
        {(['cities', 'professions', 'bulk'] as const).map((k) => (
          <TouchableOpacity
            key={k}
            style={[styles.tab, tab === k && styles.tabActive]}
            onPress={() => setTab(k)}
          >
            <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>
              {k === 'cities' ? 'Πόλεις' : k === 'professions' ? 'Επαγγέλματα' : 'Μαζική εισαγωγή'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !importRunning ? (
        <ActivityIndicator style={{ marginTop: 16 }} color="#2563eb" />
      ) : null}

      {tab === 'cities' && (
        <FlatList
          data={cities}
          keyExtractor={(item) => item.id}
          style={styles.tabList}
          contentContainerStyle={styles.section}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <>
              <TouchableOpacity style={styles.seedBtn} onPress={() => void seedEmbeddedCatalog('cities')}>
                <Text style={styles.seedBtnText}>Γέμισμα από ενσωματωμένο catalog (merge — μόνο πόλεις)</Text>
              </TouchableOpacity>
              <Text style={styles.seedHint}>
                Προστίθενται μόνο πόλεις που δεν υπάρχουν ήδη (ίδιο όνομα, χωρίς διάκριση πεζών-κεφαλαίων). Δεν
                αγγίζει τα επαγγέλματα.
              </Text>

              <Text style={styles.sectionTitle}>Προσθήκη / επεξεργασία πόλης</Text>
              <Text style={styles.label}>Όνομα πόλης</Text>
              <TextInput
                style={styles.input}
                placeholder="π.χ. Θεσσαλονίκη"
                value={cityName}
                onChangeText={(t) => {
                  setCityName(t);
                  setCityVerifiedCoords(null);
                }}
                placeholderTextColor="#94a3b8"
                autoCorrect={false}
              />
              {citySuggestions.length > 0 ? (
                <View style={styles.suggestBox}>
                  <Text style={styles.suggestTitle}>Υπάρχουσες πόλεις (επιλογή)</Text>
                  {citySuggestions.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={styles.suggestRow}
                      onPress={() => {
                        startEditCity(c);
                      }}
                    >
                      <Text style={styles.suggestText}>{c.name}</Text>
                      <Text style={styles.suggestSub}>πατήστε για επεξεργασία</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              <Text style={styles.label}>Χώρα (για geocode)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ελλάδα"
                value={cityCountry}
                onChangeText={(t) => {
                  setCityCountry(t);
                  setCityVerifiedCoords(null);
                }}
                placeholderTextColor="#94a3b8"
              />
              <TouchableOpacity
                style={styles.secondary}
                onPress={() => void verifyCity()}
                disabled={cityGeocodePending}
              >
                {cityGeocodePending ? (
                  <ActivityIndicator color="#1e40af" />
                ) : (
                  <Text style={styles.secondaryText}>Επαλήθευση (geocode)</Text>
                )}
              </TouchableOpacity>

              {cityVerifiedCoords ? (
                <View style={styles.coordsBanner}>
                  <Text style={styles.coordsBannerTitle}>Συντεταγμένες πριν την αποθήκευση</Text>
                  <Text style={styles.coordsMono} selectable>
                    lat {cityVerifiedCoords.latitude.toFixed(6)}
                    {'\n'}
                    lng {cityVerifiedCoords.longitude.toFixed(6)}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.label}>Προεπισκόπηση χάρτη</Text>
              <View style={styles.mapWrap}>
                <MapView style={styles.map} region={cityMapRegion} scrollEnabled={!!cityVerifiedCoords}>
                  {cityVerifiedCoords ? (
                    <Marker
                      coordinate={{
                        latitude: cityVerifiedCoords.latitude,
                        longitude: cityVerifiedCoords.longitude,
                      }}
                      title={cityName.trim() || 'Πόλη'}
                    />
                  ) : null}
                </MapView>
                {!cityVerifiedCoords ? (
                  <Text style={styles.mapHint}>Επαλήθευσε την πόλη για να εμφανιστεί η καρφίτσα.</Text>
                ) : null}
              </View>

              <TouchableOpacity
                style={[styles.primary, !cityVerifiedCoords && styles.primaryDisabled]}
                onPress={() => void saveCity()}
                disabled={!cityVerifiedCoords}
              >
                <Text style={styles.primaryText}>
                  {editingCityId ? 'Ενημέρωση πόλης' : 'Αποθήκευση πόλης'}
                </Text>
              </TouchableOpacity>
              {editingCityId ? (
                <TouchableOpacity onPress={clearCityForm}>
                  <Text style={styles.cancelEdit}>Ακύρωση επεξεργασίας</Text>
                </TouchableOpacity>
              ) : null}

              <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Όλες οι πόλεις (Firestore)</Text>
              <Text style={styles.listHelp}>Κύλιση παρακάτω· όνομα, χώρα και συντεταγμένες ανά εγγραφή.</Text>
              {renderCityTableHeader()}
            </>
          }
          renderItem={({ item }) => (
            <View style={styles.tableRow}>
              <View style={styles.tdName}>
                <Text style={styles.listTitle}>{item.name}</Text>
                <Text style={styles.listSub}>{item.country ?? '—'}</Text>
              </View>
              <Text style={styles.tdCoord} numberOfLines={3}>
                {item.latitude != null && item.longitude != null
                  ? `${item.latitude.toFixed(5)}\n${item.longitude.toFixed(5)}`
                  : '—'}
              </Text>
              <View style={styles.tdActions}>
                <TouchableOpacity onPress={() => startEditCity(item)} style={styles.editBtn}>
                  <Text style={styles.edit}>Επεξ.</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeCity(item.id)}>
                  <Text style={styles.del}>Διαγρ.</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyHint}>Δεν υπάρχουν ακόμα πόλεις για αυτόν τον tenant.</Text>
          }
        />
      )}

      {tab === 'professions' && (
        <FlatList
          data={professions}
          keyExtractor={(item) => item.id}
          style={styles.tabList}
          contentContainerStyle={styles.section}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <>
              <TouchableOpacity style={styles.seedBtn} onPress={() => void seedEmbeddedCatalog('professions')}>
                <Text style={styles.seedBtnText}>Γέμισμα από catalog (merge — μόνο επαγγέλματα)</Text>
              </TouchableOpacity>
              <Text style={styles.seedHint}>
                Προστίθενται μόνο επαγγέλματα που λείπουν. Δεν αγγίζει τις πόλεις.
              </Text>

              <Text style={styles.sectionTitle}>Νέο / επεξεργασία επαγγέλματος</Text>
              <Text style={styles.label}>Όνομα κατηγορίας</Text>
              <TextInput
                style={styles.input}
                placeholder="π.χ. Ηλεκτρολόγος"
                value={profName}
                onChangeText={setProfName}
                placeholderTextColor="#94a3b8"
                autoCorrect={false}
              />
              {profSuggestions.length > 0 ? (
                <View style={styles.suggestBox}>
                  <Text style={styles.suggestTitle}>Ταιριάζουν υπάρχοντα</Text>
                  {profSuggestions.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={styles.suggestRow}
                      onPress={() => {
                        setEditingProfId(p.id);
                        setProfName(p.name);
                      }}
                    >
                      <Text style={styles.suggestText}>{p.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              <TouchableOpacity style={styles.primary} onPress={() => void saveProfession()}>
                <Text style={styles.primaryText}>{editingProfId ? 'Αποθήκευση' : 'Προσθήκη'}</Text>
              </TouchableOpacity>
              {editingProfId ? (
                <TouchableOpacity onPress={clearProfForm}>
                  <Text style={styles.cancelEdit}>Ακύρωση επεξεργασίας</Text>
                </TouchableOpacity>
              ) : null}

              <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Όλα τα επαγγέλματα (Firestore)</Text>
              <Text style={styles.listHelp}>Κύλιση παρακάτω.</Text>
              {renderProfTableHeader()}
            </>
          }
          renderItem={({ item }) => (
            <View style={styles.tableRow}>
              <Text style={[styles.listTitle, styles.tdName]}>{item.name}</Text>
              <View style={styles.tdActions}>
                <TouchableOpacity
                  onPress={() => {
                    setEditingProfId(item.id);
                    setProfName(item.name);
                  }}
                  style={styles.editBtn}
                >
                  <Text style={styles.edit}>Επεξ.</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeProfession(item.id)}>
                  <Text style={styles.del}>Διαγρ.</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyHint}>Δεν υπάρχουν ακόμα επαγγέλματα για αυτόν τον tenant.</Text>
          }
        />
      )}

      {tab === 'bulk' && (
        <ScrollView contentContainerStyle={styles.section}>
            <Text style={styles.sectionTitle}>Μαζική εισαγωγή (.xlsx)</Text>
          <Text style={styles.p}>
            Οι κεφαλίδες πρέπει να ταιριάζουν με την οθόνη «Προσθήκη επαγγελματία» (ίδια πεδία). Οι συντεταγμένες
            προκύπτουν αυτόματα από geocode.
          </Text>
          <Text style={[styles.p, { marginTop: 10 }]}>
            <Text style={styles.bold}>Υποχρεωτικές στήλες</Text>
            {'\n'}• <Text style={styles.bold}>firstName</Text> / <Text style={styles.bold}>Όνομα</Text> (όταν υπάρχει
            και επωνυμία σε άλλη στήλη){'\n'}• <Text style={styles.bold}>lastName</Text> /{' '}
            <Text style={styles.bold}>Επώνυμο</Text>
            {'\n'}• <Text style={styles.bold}>businessName</Text> / <Text style={styles.bold}>Επωνυμία</Text> — ή
            παλιό template: μόνο <Text style={styles.bold}>Name</Text> / <Text style={styles.bold}>Όνομα</Text> ως
            επωνυμία (τότε όνομα/επώνυμο παράγονται από λέξεις της επωνυμίας){'\n'}•{' '}
            <Text style={styles.bold}>phone</Text> / <Text style={styles.bold}>Τηλέφωνο</Text> (έγκυρο ελληνικό){'\n'}
            • <Text style={styles.bold}>vat</Text> / <Text style={styles.bold}>ΑΦΜ</Text> (9 ψηφία){'\n'}•{' '}
            <Text style={styles.bold}>profession</Text> / <Text style={styles.bold}>Επάγγελμα</Text>
            {'\n'}• <Text style={styles.bold}>city</Text> / <Text style={styles.bold}>Πόλη</Text>
            {'\n'}• <Text style={styles.bold}>address</Text> / <Text style={styles.bold}>Οδός</Text>
            {'\n'}• <Text style={styles.bold}>addressNumber</Text> / <Text style={styles.bold}>Αριθμός</Text>
            {'\n'}• <Text style={styles.bold}>zip</Text> / <Text style={styles.bold}>ΤΚ</Text>
          </Text>
          <Text style={[styles.p, { marginTop: 10 }]}>
            <Text style={styles.bold}>Προαιρετικές στήλες</Text>
            {'\n'}• <Text style={styles.bold}>email</Text> (αν συμπληρωθεί, έγκυρη μορφή){'\n'}•{' '}
            <Text style={styles.bold}>country</Text> / <Text style={styles.bold}>Χώρα</Text> (προεπιλογή Ελλάδα)
            {'\n'}• <Text style={styles.bold}>area</Text> / <Text style={styles.bold}>Περιοχή</Text>
            {'\n'}• <Text style={styles.bold}>website</Text>, <Text style={styles.bold}>bio</Text>
            {'\n'}• Υπηρεσία: <Text style={styles.bold}>serviceName</Text>, <Text style={styles.bold}>serviceDesc</Text>,{' '}
            <Text style={styles.bold}>servicePrice</Text>, <Text style={styles.bold}>servicePriceBasis</Text> (fixed,
            per_hour, per_visit, on_quote / ελληνικά συνώνυμα), <Text style={styles.bold}>serviceTimeEstimate</Text>
            {'\n'}• <Text style={styles.bold}>profileDisplayType</Text>: male, female, company (ή συνώνυμα)
          </Text>
          <Text style={[styles.p, { marginTop: 10, color: '#64748b' }]}>
            Πρώτη γραμμή του φύλλου = κεφαλίδες. Τα ονόματα στηλών γίνονται case-insensitive. Αν λείπουν όνομα/επώνυμο,
            χρησιμοποίησε επωνυμία με τουλάχιστον δύο λέξεις (πρώτη = όνομα, υπόλοιπο = επώνυμο).
          </Text>
          <TouchableOpacity
            style={[styles.primary, importRunning && styles.primaryDisabled]}
            onPress={() => void pickExcel()}
            disabled={importRunning}
          >
            <Text style={styles.primaryText}>Επίλεξε αρχείο .xlsx</Text>
          </TouchableOpacity>
          {importRunning ? (
            <View style={styles.importStatus}>
              <ActivityIndicator color="#2563eb" />
              <Text style={styles.importStatusText}>Geocoding & αποθήκευση… {importProgress}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      <Modal visible={failuresModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Αποτυχίες import ({importFailures.length})</Text>
            <FlatList
              data={importFailures}
              keyExtractor={(_, i) => `f-${i}`}
              style={styles.failuresList}
              renderItem={({ item }) => (
                <View style={styles.failureRow}>
                  <Text style={styles.failureRowTitle}>Γραμμή {item.row}</Text>
                  <Text style={styles.failureQuery} numberOfLines={3}>
                    {item.query || '(κενό)'}
                  </Text>
                  <Text style={styles.failureReason}>{item.reason}</Text>
                </View>
              )}
            />
            <Pressable style={styles.modalClose} onPress={() => setFailuresModalVisible(false)}>
              <Text style={styles.modalCloseText}>Κλείσιμο</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  tabList: { flex: 1 },
  tenantLeaderBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    padding: 14,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  tenantLeaderTitle: { fontSize: 16, fontWeight: '800', color: '#1e3a8a', marginBottom: 8 },
  tenantLeaderBody: { fontSize: 13, color: '#1e40af', lineHeight: 20 },
  tenantLeaderMono: {
    marginTop: 10,
    fontSize: 12,
    color: '#3730a3',
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    lineHeight: 18,
  },
  warnInline: { marginTop: 10, fontSize: 13, fontWeight: '600', color: '#b45309', lineHeight: 19 },
  tenantPickerWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tenantHint: { fontSize: 12, color: '#64748b', marginTop: 6, lineHeight: 17 },
  adminGuideCard: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    overflow: 'hidden',
  },
  adminGuideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  adminGuideTitle: { fontSize: 15, fontWeight: '800', color: '#1e3a8a', flex: 1 },
  adminGuideToggle: { fontSize: 14, color: '#2563eb', fontWeight: '700' },
  adminGuideBody: { paddingHorizontal: 14, paddingBottom: 14 },
  adminGuideStep: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 10,
  },
  adminGuideNum: { fontWeight: '800', color: '#2563eb' },
  centered: { flex: 1, justifyContent: 'center', padding: 24 },
  warn: { fontSize: 16, color: '#b45309', textAlign: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  tabText: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  tabTextActive: { color: '#2563eb' },
  section: { padding: 16, paddingBottom: 48 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a', marginBottom: 10 },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#cbd5e1',
    marginBottom: 4,
  },
  th: { fontSize: 12, fontWeight: '700', color: '#475569', textTransform: 'uppercase' },
  thName: { flex: 1.4 },
  thCoord: { flex: 1 },
  thActions: { width: 100 },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tdName: { flex: 1.4 },
  tdCoord: { flex: 1, fontSize: 11, color: '#64748b' },
  tdActions: { width: 100, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  emptyHint: { color: '#94a3b8', fontStyle: 'italic', paddingVertical: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    fontSize: 16,
    color: '#0f172a',
  },
  mapWrap: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#e2e8f0',
  },
  map: { flex: 1 },
  mapHint: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    padding: 8,
    borderRadius: 8,
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
  },
  secondary: {
    backgroundColor: '#e0e7ff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  secondaryText: { color: '#1e40af', fontWeight: '700', fontSize: 16 },
  primary: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryDisabled: { opacity: 0.45 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  seedBtn: {
    backgroundColor: '#e0e7ff',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  seedBtnText: { color: '#3730a3', fontWeight: '700', fontSize: 14 },
  seedHint: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 17,
    marginBottom: 14,
  },
  listHelp: { fontSize: 12, color: '#94a3b8', marginBottom: 8 },
  suggestBox: {
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    marginBottom: 12,
    overflow: 'hidden',
  },
  suggestTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4338ca',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
    textTransform: 'uppercase',
  },
  suggestRow: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e7ff',
  },
  suggestText: { fontSize: 15, fontWeight: '600', color: '#1e1b4b' },
  suggestSub: { fontSize: 11, color: '#6366f1', marginTop: 2 },
  coordsBanner: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#6ee7b7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  coordsBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065f46',
    marginBottom: 6,
  },
  coordsMono: {
    fontSize: 14,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    color: '#047857',
  },
  listTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  listSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  del: { color: '#dc2626', fontWeight: '600', marginLeft: 6, fontSize: 13 },
  edit: { color: '#2563eb', fontWeight: '600', fontSize: 13 },
  editBtn: { marginRight: 4 },
  cancelEdit: {
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  p: { fontSize: 14, color: '#475569', lineHeight: 21, marginBottom: 16 },
  bold: { fontWeight: '700', color: '#0f172a' },
  importStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  importStatusText: { fontSize: 14, color: '#334155', flex: 1 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    maxHeight: '80%',
    padding: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  failuresList: { maxHeight: 360 },
  failureRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  failureRowTitle: { fontWeight: '700', color: '#b45309', marginBottom: 4 },
  failureQuery: { fontSize: 13, color: '#334155', marginBottom: 4 },
  failureReason: { fontSize: 12, color: '#64748b' },
  modalClose: {
    marginTop: 12,
    backgroundColor: '#f1f5f9',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseText: { fontWeight: '700', color: '#0f172a' },
});
