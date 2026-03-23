/**
 * Admin: CRUD cities / professions, λίστες Firestore ανά tenant, autocomplete, anti-duplicate,
 * catalog merge ξεχωριστά: μόνο πόλεις ή μόνο επαγγέλματα (μόνο νέα ονόματα), Excel import με geocode ανά γραμμή.
 * Πόλεις: Verify → συντεταγμένες + χάρτης → Save.
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
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db } from '../api';
import { CITIES, PROFESSIONS, type CityOption } from '../constants/data';
import { FormSelect } from '../components/FormSelect';

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
  name: string;
  profession: string;
  city: string;
  address: string;
  phone: string;
};

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
          ? 'Επίλεξε tenant (λίστα παραπάνω) ή δημιούργησε έναν από το Super Admin Dashboard.'
          : 'Το προφίλ σου δεν έχει tenantId.'
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
      Alert.alert('Διπλότυπο', 'This entry already exists!');
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
    Alert.alert('Διαγραφή πόλης;', undefined, [
      { text: 'Άκυρο', style: 'cancel' },
      {
        text: 'Διαγραφή',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteDoc(doc(db, 'cities', id));
              await loadAll();
            } catch (e) {
              Alert.alert('Σφάλμα', e instanceof Error ? e.message : '');
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
      Alert.alert('Διπλότυπο', 'This entry already exists!');
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
    } catch (e) {
      Alert.alert('Σφάλμα', e instanceof Error ? e.message : '');
    } finally {
      setLoading(false);
    }
  };

  const removeProfession = (id: string) => {
    Alert.alert('Διαγραφή επαγγέλματος;', undefined, [
      { text: 'Άκυρο', style: 'cancel' },
      {
        text: 'Διαγραφή',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteDoc(doc(db, 'professions', id));
              await loadAll();
            } catch (e) {
              Alert.alert('Σφάλμα', e instanceof Error ? e.message : '');
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
    return rows.map((row) => ({
      name: pickCell(row, 'name', 'όνομα', 'επωνυμία', 'businessname'),
      profession: pickCell(row, 'profession', 'category', 'επάγγελμα'),
      city: pickCell(row, 'city', 'πόλη'),
      address: pickCell(row, 'address', 'διεύθυνση'),
      phone: pickCell(row, 'phone', 'τηλέφωνο', 'tel', 'mobile'),
    }));
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

      const name = row.name.trim();
      const profession = row.profession.trim();
      const city = row.city.trim();
      const address = row.address.trim();
      const phone = row.phone.trim();

      if (!name) {
        failures.push({ row: sheetRow, query: '', reason: 'Κενό όνομα (Name)' });
        continue;
      }

      const geoQuery = [address, city, 'Greece'].filter((p) => p.length > 0).join(', ');
      if (!geoQuery || geoQuery === 'Greece') {
        failures.push({
          row: sheetRow,
          query: geoQuery || address + city,
          reason: 'Κενή διεύθυνση ή πόλη',
        });
        continue;
      }

      await sleep(GEOCODE_STAGGER_MS);

      try {
        const geo = await Location.geocodeAsync(geoQuery);
        if (!geo?.length) {
          failures.push({ row: sheetRow, query: geoQuery, reason: 'Δεν βρέθηκε συντεταγμένη' });
          continue;
        }
        const { latitude, longitude } = geo[0];
        await addDoc(collection(db, 'importedProfessionals'), {
          businessName: name,
          profession,
          city,
          address,
          phone,
          latitude,
          longitude,
          country: 'Ελλάδα',
          tenantId: tid,
          importedAt: Timestamp.now(),
          source: 'excel_geocode',
        });
        saved += 1;
      } catch (e) {
        failures.push({
          row: sheetRow,
          query: geoQuery,
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
        `Βρέθηκαν ${parsed.length} γραμμές. Θα γίνει geocode για κάθε διεύθυνση (μπορεί να πάρει λίγα λεπτά). Συνέχεια;`,
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
          Ως Super Admin, όλες οι ενέργειες εδώ ισχύουν για τον επιλεγμένο tenant.
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
              Επίλεξε σωστό tenant (αν είσαι Super Admin). Όλες οι αλλαγές πόλεων/επαγγελμάτων πάνε σε αυτόν τον
              tenant.
            </Text>
            <Text style={styles.adminGuideStep}>
              <Text style={styles.adminGuideNum}>2. </Text>
              Καρτέλα Cities: «Γέμισμα από ενσωματωμένο catalog (merge)» προσθέτει μόνο πόλεις που λείπουν — όχι
              επαγγέλματα.
            </Text>
            <Text style={styles.adminGuideStep}>
              <Text style={styles.adminGuideNum}>3. </Text>
              Καρτέλα Professions: το αντίστοιχο κουμπί προσθέτει μόνο επαγγέλματα από το ενσωματωμένο catalog.
            </Text>
            <Text style={styles.adminGuideStep}>
              <Text style={styles.adminGuideNum}>4. </Text>
              Μπορείς να προσθέτεις/διορθώνεις χειροκίνητα· το merge δεν σβήνει τίποτα, μόνο συμπληρώνει νέα ονόματα.
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
              {k === 'cities' ? 'Cities' : k === 'professions' ? 'Professions' : 'Excel Upload'}
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
            Απαιτούμενες στήλες (κεφαλίδες): <Text style={styles.bold}>Name</Text>,{' '}
            <Text style={styles.bold}>Profession</Text>, <Text style={styles.bold}>City</Text>,{' '}
            <Text style={styles.bold}>Address</Text>, <Text style={styles.bold}>Phone</Text>. Δεν χρειάζονται
            συντεταγμένες — γίνεται αυτόματο geocode για κάθε γραμμή (διεύθυνση + πόλη + Greece).
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
            <Text style={styles.modalTitle}>Αποτυχημένες διευθύνσεις ({importFailures.length})</Text>
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
