/**
 * Admin: CRUD cities / professions, Excel import με geocode ανά γραμμή.
 * Πόλεις: Verify → Location.geocodeAsync → προεπισκόπηση χάρτη → Save.
 * Excel: στήλες Name, Profession, City, Address, Phone — geocode "Address, City, Greece".
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
type ProfRow = { id: string; name: string; icon?: string };

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
  const [profIcon, setProfIcon] = useState('');
  const [editingProfId, setEditingProfId] = useState<string | null>(null);

  const [importRunning, setImportRunning] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [importFailures, setImportFailures] = useState<GeocodeFailure[]>([]);
  const [failuresModalVisible, setFailuresModalVisible] = useState(false);

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
            const x = d.data() as ProfRow;
            return {
              id: d.id,
              name: x.name ?? d.id,
              icon: typeof x.icon === 'string' ? x.icon : undefined,
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
    setProfIcon('');
    setEditingProfId(null);
  };

  const saveProfession = async () => {
    const name = profName.trim();
    if (!name) {
      Alert.alert('Συμπλήρωσε επάγγελμα.');
      return;
    }
    const icon = profIcon.trim();
    const tid = requireWriteTenant();
    if (!tid) return;

    setLoading(true);
    try {
      if (editingProfId) {
        await updateDoc(doc(db, 'professions', editingProfId), { name, icon: icon || '', tenantId: tid });
      } else {
        await addDoc(collection(db, 'professions'), { name, icon: icon || '', tenantId: tid });
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

  const seedCatalog = async () => {
    const tid = requireWriteTenant();
    if (!tid) return;

    setLoading(true);
    try {
      for (let i = 0; i < CITIES.length; i++) {
        const c = CITIES[i];
        await sleep(GEOCODE_STAGGER_MS);
        const { latitude, longitude } = await coordsForCatalogCity(c);
        const slug = c.label.replace(/\s+/g, '_');
        const id = `${tid}_${slug}`;
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
      }
      for (let i = 0; i < PROFESSIONS.length; i++) {
        const p = PROFESSIONS[i];
        await setDoc(
          doc(db, 'professions', `${tid}_catalog_prof_${i}`),
          { name: p, icon: '', tenantId: tid },
          { merge: true }
        );
      }
      await loadAll();
      refreshFirestoreCatalog();
      Alert.alert(
        'OK',
        'Οι πόλεις (με geocode) και τα επαγγέλματα από το catalog ανέβηκαν στο Firestore (merge).'
      );
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
      <Text style={[styles.th, styles.thIcon]}>Εικονίδιο</Text>
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
        <ScrollView contentContainerStyle={styles.section}>
          <TouchableOpacity style={styles.seedBtn} onPress={() => void seedCatalog()}>
            <Text style={styles.seedBtnText}>Γέμισμα από ενσωματωμένο catalog (merge)</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Τρέχουσες πόλεις (Firestore)</Text>
          {renderCityTableHeader()}
          {cities.length === 0 ? (
            <Text style={styles.emptyHint}>Δεν υπάρχουν εγγραφές.</Text>
          ) : (
            cities.map((item) => (
              <View key={item.id} style={styles.tableRow}>
                <View style={styles.tdName}>
                  <Text style={styles.listTitle}>{item.name}</Text>
                  <Text style={styles.listSub}>{item.country ?? '—'}</Text>
                </View>
                <Text style={styles.tdCoord} numberOfLines={2}>
                  {item.latitude != null && item.longitude != null
                    ? `${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}`
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
            ))
          )}

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Προσθήκη / επεξεργασία πόλης</Text>
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
          />
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
        </ScrollView>
      )}

      {tab === 'professions' && (
        <ScrollView contentContainerStyle={styles.section}>
          <Text style={styles.sectionTitle}>Τρέχοντα επαγγέλματα (Firestore)</Text>
          {renderProfTableHeader()}
          {professions.length === 0 ? (
            <Text style={styles.emptyHint}>Δεν υπάρχουν εγγραφές.</Text>
          ) : (
            professions.map((item) => (
              <View key={item.id} style={styles.tableRow}>
                <Text style={[styles.listTitle, styles.tdName]}>{item.name}</Text>
                <Text style={styles.tdIcon} numberOfLines={1}>
                  {item.icon?.trim() ? item.icon : '—'}
                </Text>
                <View style={styles.tdActions}>
                  <TouchableOpacity
                    onPress={() => {
                      setEditingProfId(item.id);
                      setProfName(item.name);
                      setProfIcon(item.icon ?? '');
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
            ))
          )}

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Νέο / επεξεργασία επαγγέλματος</Text>
          <Text style={styles.label}>Όνομα κατηγορίας</Text>
          <TextInput
            style={styles.input}
            placeholder="π.χ. Ηλεκτρολόγος"
            value={profName}
            onChangeText={setProfName}
            placeholderTextColor="#94a3b8"
          />
          <Text style={styles.label}>Όνομα εικονιδίου (προαιρετικό)</Text>
          <TextInput
            style={styles.input}
            placeholder="π.χ. zap (μελλοντικό UI)"
            value={profIcon}
            onChangeText={setProfIcon}
            placeholderTextColor="#94a3b8"
          />
          <TouchableOpacity style={styles.primary} onPress={() => void saveProfession()}>
            <Text style={styles.primaryText}>{editingProfId ? 'Αποθήκευση' : 'Προσθήκη'}</Text>
          </TouchableOpacity>
          {editingProfId ? (
            <TouchableOpacity onPress={clearProfForm}>
              <Text style={styles.cancelEdit}>Ακύρωση επεξεργασίας</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
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
  tenantPickerWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tenantHint: { fontSize: 12, color: '#64748b', marginTop: 6, lineHeight: 17 },
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
  thIcon: { flex: 0.9 },
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
  tdIcon: { flex: 0.9, fontSize: 13, color: '#334155' },
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
