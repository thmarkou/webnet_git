/**
 * Προσθήκη επαγγελματία από διαχειριστή — ίδια λογική πεδίων με την «Εγγραφή Επαγγελματία»
 * (τύπος προφίλ, φωτογραφία, διεύθυνση + χάρτης, στοιχεία, επιχείρηση, υπηρεσία).
 * Πόλη & επάγγελμα μόνο από Firestore (tenant). Χωρίς κωδικό — δεν αλλάζει η σύνδεση διαχειριστή.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { collection, getDocs, query, where } from 'firebase/firestore';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { MapPin } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { db } from '../api';
import { FormSelect } from '../components/FormSelect';
import { SearchableSelect, type SearchableSelectOption } from '../components/SearchableSelect';
import { professionDisplayForStored } from '../utils/professionDisplay';
import { matchCityFromGeocode } from '../constants/data';
import { finiteCoordsOrUndefined } from '../api/userDocument';
import { isValidGreekPhone } from '../utils/phoneValidation';
import type { ProfileDisplayType, ServicePriceBasis } from '../api/types';
import { SERVICE_PRICE_BASIS_CHIPS } from '../utils/servicePricing';
import {
  profileDisplayTypeToAvatarKind,
  ProfessionalAvatarIcon,
} from '../assets/avatars';

const DEFAULT_TENANT_ID = 'tenant_default';
const MAP_DELTA_WIDE = { latitudeDelta: 0.06, longitudeDelta: 0.06 };
const MAP_DELTA_PRECISE = { latitudeDelta: 0.004, longitudeDelta: 0.004 };

type TenantPickRow = { tenantId: string; displayName: string };

function tenantOptionLabel(r: TenantPickRow): string {
  return `${r.displayName} (${r.tenantId})`;
}

function parseTenantIdFromOption(label: string): string {
  const m = label.match(/\(([^)]+)\)\s*$/);
  return m ? m[1].trim() : '';
}

type CityRow = {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
};

function servicePricePlaceholder(basis: ServicePriceBasis): string {
  switch (basis) {
    case 'per_hour':
      return 'Τιμή ανά ώρα (€)';
    case 'per_visit':
      return 'Τιμή ανά επίσκεψη (€)';
    case 'on_quote':
      return 'Ενδεικτική τιμή (€, προαιρετικό)';
    default:
      return 'Τιμή (€)';
  }
}

function simpleEmailValid(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

const emptyForm = () => ({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  businessName: '',
  vat: '',
  profession: '',
  website: '',
  bio: '',
  address: '',
  addressNumber: '',
  area: '',
  zip: '',
  city: '',
  country: 'Ελλάδα',
  serviceName: '',
  serviceDesc: '',
  servicePriceBasis: 'fixed' as ServicePriceBasis,
  serviceTimeEstimate: '',
  servicePrice: '',
});

export default function AdminAddProfessionalScreen() {
  const {
    isSuperAdmin,
    tenantId: authTenantId,
    canAccessAdminDashboard,
    createProfessionalRecordAsAdmin,
  } = useAuth();

  const [tenantRows, setTenantRows] = useState<TenantPickRow[]>([]);
  const [adminScopeTenantId, setAdminScopeTenantId] = useState('');
  const [cities, setCities] = useState<CityRow[]>([]);
  const [professionNames, setProfessionNames] = useState<string[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const updateField = (field: keyof ReturnType<typeof emptyForm>, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const [selectedCityId, setSelectedCityId] = useState('');
  const [profileDisplayType, setProfileDisplayType] = useState<ProfileDisplayType>('male');
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [profileImageBase64, setProfileImageBase64] = useState<string | null>(null);

  const [region, setRegion] = useState({
    latitude: 37.9838,
    longitude: 23.7275,
    ...MAP_DELTA_WIDE,
  });
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeHint, setGeocodeHint] = useState<string | null>(null);
  const updatingFromMapRef = useRef(false);

  const [saving, setSaving] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);

  const effectiveTenantId = isSuperAdmin ? adminScopeTenantId : (authTenantId ?? '');

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
          const def = rows.find((r) => r.tenantId === DEFAULT_TENANT_ID);
          if (def) return def.tenantId;
          return rows[0]?.tenantId ?? '';
        });
      } catch {
        setTenantRows([]);
      }
    })();
  }, [isSuperAdmin, canAccessAdminDashboard]);

  useEffect(() => {
    if (!isSuperAdmin && authTenantId) {
      setAdminScopeTenantId(authTenantId);
    }
  }, [isSuperAdmin, authTenantId]);

  const loadCatalog = useCallback(async (tid: string) => {
    if (!tid) {
      setCities([]);
      setProfessionNames([]);
      return;
    }
    setCatalogLoading(true);
    try {
      const [cSnap, pSnap] = await Promise.all([
        getDocs(query(collection(db, 'cities'), where('tenantId', '==', tid))),
        getDocs(query(collection(db, 'professions'), where('tenantId', '==', tid))),
      ]);
      const cityList: CityRow[] = cSnap.docs
        .map((d) => {
          const x = d.data() as {
            name?: string;
            latitude?: number;
            longitude?: number;
            country?: string;
          };
          const lat = typeof x.latitude === 'number' ? x.latitude : NaN;
          const lng = typeof x.longitude === 'number' ? x.longitude : NaN;
          return {
            id: d.id,
            name: String(x.name ?? d.id).trim(),
            country: String(x.country ?? 'Ελλάδα'),
            latitude: lat,
            longitude: lng,
          };
        })
        .filter((c) => c.name.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name, 'el'));

      const profList = pSnap.docs
        .map((d) => String((d.data() as { name?: string }).name ?? d.id).trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'el'));

      setCities(cityList);
      setProfessionNames(profList);
    } catch (e) {
      Alert.alert('Σφάλμα', e instanceof Error ? e.message : 'Firestore');
      setCities([]);
      setProfessionNames([]);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog(effectiveTenantId);
  }, [effectiveTenantId, loadCatalog]);

  const cityOptions: SearchableSelectOption[] = useMemo(
    () =>
      cities.map((c) => ({
        value: c.id,
        label: c.name,
        subtitle: c.country,
      })),
    [cities]
  );

  const professionOptions: SearchableSelectOption[] = useMemo(
    () =>
      professionNames.map((n) => ({
        value: n,
        label: professionDisplayForStored(n).label,
      })),
    [professionNames]
  );

  const moveMapTo = useCallback((lat: number, lng: number, mode: 'wide' | 'precise' = 'precise') => {
    const d = mode === 'wide' ? MAP_DELTA_WIDE : MAP_DELTA_PRECISE;
    setRegion({ latitude: lat, longitude: lng, ...d });
  }, []);

  const applyReverseGeocode = useCallback(async (lat: number, lng: number) => {
    updatingFromMapRef.current = true;
    setGeocoding(true);
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const a = results[0];
      if (!a) return;

      const street = a.street ?? a.name ?? '';
      const num = a.streetNumber ?? '';

      setForm((prev) => {
        const matched = matchCityFromGeocode(a.city ?? a.region ?? a.subregion ?? undefined);
        const countryName =
          a.isoCountryCode === 'GR' || (a.country ?? '').toLowerCase().includes('greece')
            ? 'Ελλάδα'
            : a.country ?? 'Ελλάδα';
        return {
          ...prev,
          address: street || prev.address,
          addressNumber: num || prev.addressNumber,
          area: a.district ?? a.subregion ?? a.region ?? prev.area,
          zip: a.postalCode ?? prev.zip,
          city: matched?.label ?? prev.city,
          country: countryName,
        };
      });
    } catch {
      /* offline */
    } finally {
      setGeocoding(false);
      setTimeout(() => {
        updatingFromMapRef.current = false;
      }, 150);
    }
  }, []);

  const onPinMoved = useCallback(
    (lat: number, lng: number) => {
      setLatitude(lat);
      setLongitude(lng);
      moveMapTo(lat, lng, 'precise');
      setGeocodeHint(null);
      void applyReverseGeocode(lat, lng);
    },
    [moveMapTo, applyReverseGeocode]
  );

  const verifyAddress = useCallback(async () => {
    const { address, addressNumber, city, country, zip, area } = form;
    if (!city.trim() || !address.trim()) {
      Alert.alert('Συμπλήρωσε οδό και πόλη.');
      return;
    }
    if (!zip.trim()) {
      Alert.alert('Συμπλήρωσε ΤΚ', 'Ο ταχυδρομικός κώδικας βοηθά το geocoding.');
      return;
    }
    if (updatingFromMapRef.current) return;

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Άρνηση πρόσβασης', 'Χρειάζεται άδεια τοποθεσίας για επαλήθευση διεύθυνσης.');
      return;
    }

    const streetLine = [address.trim(), addressNumber.trim()].filter(Boolean).join(' ').trim();
    const locality = [zip.trim(), area.trim(), city.trim()].filter(Boolean).join(', ');
    const primary =
      country.trim() === 'Ελλάδα' || !country.trim()
        ? `${streetLine}, ${locality}, Greece`
        : `${streetLine}, ${locality}, ${country.trim()}`;
    const fallback = `${streetLine}, ${city.trim()}, Greece`;

    setGeocoding(true);
    setGeocodeHint(null);
    try {
      let results = await Location.geocodeAsync(primary);
      if (!results?.length) {
        results = await Location.geocodeAsync(fallback);
      }
      const first = results[0];
      if (first && first.latitude != null && first.longitude != null) {
        setLatitude(first.latitude);
        setLongitude(first.longitude);
        moveMapTo(first.latitude, first.longitude, 'precise');
        setGeocodeHint(
          'Έλεγχος OK — δες το pin. Σύρε το στο ακριβές σημείο αν χρειάζεται· αυτές οι συντεταγμένες αποθηκεύονται.'
        );
      } else {
        setGeocodeHint(
          'Δεν βρέθηκε σημείο — όρισε το pin στον χάρτη ή «Τρέχουσα τοποθεσία».'
        );
      }
    } catch {
      setGeocodeHint('Αποτυχία geocoding — όρισε το pin χειροκίνητα στον χάρτη.');
    } finally {
      setGeocoding(false);
    }
  }, [form, moveMapTo]);

  const handleCityIdChange = (id: string) => {
    setSelectedCityId(id);
    const c = cities.find((x) => x.id === id);
    if (c) {
      setForm((prev) => ({ ...prev, city: c.name, country: c.country }));
      const coords = finiteCoordsOrUndefined(c.latitude, c.longitude);
      if (coords) {
        setLatitude(coords.latitude);
        setLongitude(coords.longitude);
        moveMapTo(coords.latitude, coords.longitude, 'wide');
      }
      setGeocodeHint('Επίλεξε οδό και αριθμό για ακριβές σημείο, ή μετακίνησε το pin.');
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Άρνηση πρόσβασης', 'Χρειάζεται πρόσβαση στη συλλογή φωτογραφιών.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setProfileImageUri(uri);
      try {
        const manipulated = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 200, height: 200 } }],
          {
            format: ImageManipulator.SaveFormat.JPEG,
            compress: 0.6,
            base64: true,
          }
        );
        if (manipulated.base64) {
          setProfileImageBase64(manipulated.base64);
        }
      } catch {
        setProfileImageBase64(null);
      }
    }
  };

  const useCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Άρνηση πρόσβασης', 'Χρειάζεται πρόσβαση στην τοποθεσία.');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
    });
    const { latitude: lat, longitude: lng } = loc.coords;
    onPinMoved(lat, lng);
  };

  const handleMapPress = (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
    onPinMoved(lat, lng);
  };

  useEffect(() => {
    if (successVisible) {
      const t = setTimeout(() => setSuccessVisible(false), 2800);
      return () => clearTimeout(t);
    }
  }, [successVisible]);

  const resetForm = () => {
    setForm(emptyForm());
    setSelectedCityId('');
    setProfileDisplayType('male');
    setProfileImageUri(null);
    setProfileImageBase64(null);
    setLatitude(undefined);
    setLongitude(undefined);
    setGeocodeHint(null);
    setRegion({ latitude: 37.9838, longitude: 23.7275, ...MAP_DELTA_WIDE });
  };

  const handleSave = async () => {
    if (!canAccessAdminDashboard) {
      Alert.alert('Δεν επιτρέπεται', 'Χρειάζεσαι δικαιώματα διαχειριστή.');
      return;
    }
    if (!effectiveTenantId) {
      Alert.alert('Tenant', 'Επίλεξε tenant (ή ρύθμισε tenantId στο προφίλ σου).');
      return;
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      businessName,
      vat,
      address,
      profession,
      city,
    } = form;

    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !businessName.trim() ||
      !vat.trim() ||
      !address.trim() ||
      !form.addressNumber.trim() ||
      !form.zip.trim() ||
      !profession ||
      !city.trim()
    ) {
      Alert.alert(
        'Υποχρεωτικά',
        'Συμπλήρωσε: Όνομα, Επώνυμο, Επωνυμία, ΑΦΜ, Οδός, Αριθμός, ΤΚ, Επάγγελμα, Πόλη — και όρισε pin στον χάρτη.'
      );
      return;
    }

    if (!phone.trim() || !isValidGreekPhone(phone)) {
      Alert.alert('Τηλέφωνο', 'Έλεγξε τον αριθμό (π.χ. κινητό 69xxxxxxxx).');
      return;
    }

    if (email.trim() && !simpleEmailValid(email)) {
      Alert.alert('Email', 'Μη έγκυρη μορφή email.');
      return;
    }

    if (vat.length !== 9) {
      Alert.alert('ΑΦΜ', 'Το ΑΦΜ πρέπει να έχει 9 ψηφία.');
      return;
    }

    if (latitude == null || longitude == null) {
      Alert.alert(
        'Χάρτης',
        'Όρισε τοποθεσία: «Επαλήθευση διεύθυνσης», πάτημα στον χάρτη, ή «Τρέχουσα τοποθεσία», και σύρε το pin αν χρειάζεται.'
      );
      return;
    }

    setSaving(true);
    try {
      await createProfessionalRecordAsAdmin({
        tenantId: effectiveTenantId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        profession: profession.trim(),
        location: `${city.trim()}, ${form.country.trim() || 'Ελλάδα'}`,
        businessName: businessName.trim(),
        vat: vat.trim(),
        website: form.website.trim(),
        bio: form.bio.trim(),
        address: address.trim(),
        addressNumber: form.addressNumber.trim(),
        area: form.area.trim(),
        zip: form.zip.trim(),
        city: city.trim(),
        country: form.country.trim() || 'Ελλάδα',
        profileDisplayType,
        profileImageBase64: profileImageBase64 ?? null,
        latitude,
        longitude,
        serviceName: form.serviceName.trim(),
        serviceDesc: form.serviceDesc.trim(),
        servicePriceBasis: form.servicePriceBasis,
        serviceTimeEstimate: form.serviceTimeEstimate.trim(),
        servicePrice: parseFloat(form.servicePrice.replace(',', '.')) || 0,
      });
      resetForm();
      setSuccessVisible(true);
    } catch (e) {
      Alert.alert('Σφάλμα', e instanceof Error ? e.message : 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  if (!canAccessAdminDashboard) {
    return (
      <View style={styles.centered}>
        <Text style={styles.warn}>Μόνο για διαχειριστές.</Text>
      </View>
    );
  }

  const selectedTenantRow = tenantRows.find((r) => r.tenantId === adminScopeTenantId);

  const tenantPicker =
    isSuperAdmin && tenantRows.length > 0 ? (
      <View style={styles.block}>
        <FormSelect
          label="Tenant (δίκτυο)"
          value={selectedTenantRow ? tenantOptionLabel(selectedTenantRow) : ''}
          options={tenantRows.map(tenantOptionLabel)}
          onChange={(label) => setAdminScopeTenantId(parseTenantIdFromOption(label))}
          placeholder="Επίλεξε tenant"
        />
        <Text style={styles.hint}>
          Πόλεις / επάγγελμα φορτώνονται από Firestore για αυτόν τον tenant. Η καταχώρηση είναι ισοδύναμη με την
          εγγραφή επαγγελματία (χωρίς κωδικό σύνδεσης).
        </Text>
      </View>
    ) : isSuperAdmin && tenantRows.length === 0 ? (
      <Text style={styles.warn}>
        Δεν υπάρχουν tenants. Δημιούργησε έναν από το Super Admin Dashboard (π.χ. tenant_default).
      </Text>
    ) : null;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.section}
        keyboardShouldPersistTaps="handled"
      >
        {successVisible ? (
          <View style={styles.toast}>
            <Text style={styles.toastText}>Αποθηκεύτηκε ο επαγγελματίας. Μπορείς να προσθέσεις επόμενο.</Text>
          </View>
        ) : null}

        <Text style={styles.title}>Προσθήκη επαγγελματία</Text>
        <Text style={styles.sub}>
          Ίδια πεδία με την αρχική εγγραφή επαγγελματία. Ρόλος στη βάση:{' '}
          <Text style={styles.mono}>pro</Text>. Πόλη & επάγγελμα μόνο από τις συλλογές Firestore του tenant.
        </Text>
        <View style={styles.trialBanner}>
          <Text style={styles.trialBannerTitle}>Δοκιμαστική περίοδος 30 ημερών</Text>
          <Text style={styles.trialBannerText}>
            Όπως στην εγγραφή: αποθηκεύονται trialEndDate και accountStatus trial — χωρίς δημιουργία λογαριασμού
            σύνδεσης (κωδικός).
          </Text>
        </View>

        {tenantPicker}

        {catalogLoading ? (
          <ActivityIndicator style={{ marginVertical: 16 }} color="#059669" />
        ) : null}

        <Text style={styles.sectionLabel}>Τύπος προφίλ *</Text>
        <Text style={styles.hintSmall}>
          Χωρίς φωτογραφία εμφανίζεται εικονίδιο ανά τύπο (όπως στην εγγραφή).
        </Text>
        <View style={styles.profileTypeRow}>
          {(
            [
              { key: 'male' as ProfileDisplayType, label: 'Άνδρας' },
              { key: 'female' as ProfileDisplayType, label: 'Γυναίκα' },
              { key: 'company' as ProfileDisplayType, label: 'Εταιρεία' },
            ] as const
          ).map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.profileTypeChip,
                profileDisplayType === key && styles.profileTypeChipActive,
              ]}
              onPress={() => setProfileDisplayType(key)}
              disabled={saving}
            >
              <Text
                style={[
                  styles.profileTypeChipText,
                  profileDisplayType === key && styles.profileTypeChipTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Φωτογραφία προφίλ</Text>
        <TouchableOpacity style={styles.photoButton} onPress={() => void pickImage()} disabled={saving}>
          {profileImageUri ? (
            <Image source={{ uri: profileImageUri }} style={styles.photoPreview} />
          ) : (
            <View style={styles.photoPlaceholderWithIcon}>
              <ProfessionalAvatarIcon
                kind={profileDisplayTypeToAvatarKind(profileDisplayType)}
                size={48}
                color="#fff"
              />
              <Text style={styles.photoTextOnGreen}>Πάτα για φωτογραφία (προαιρετικό)</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Διεύθυνση εργασίας & χάρτης</Text>
        <Text style={styles.hint}>
          Συμπλήρωσε οδό, αριθμό, ΤΚ· επίλεξε πόλη από τη λίστα Firestore. Επαλήθευση / pin όπως στην εγγραφή.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Διεύθυνση (οδός) *"
          placeholderTextColor="#94a3b8"
          value={form.address}
          onChangeText={(v) => updateField('address', v)}
          editable={!saving}
        />
        <TextInput
          style={styles.input}
          placeholder="Αριθμός *"
          placeholderTextColor="#94a3b8"
          value={form.addressNumber}
          onChangeText={(v) => updateField('addressNumber', v)}
          editable={!saving}
        />
        <TextInput
          style={styles.input}
          placeholder="Περιοχή"
          placeholderTextColor="#94a3b8"
          value={form.area}
          onChangeText={(v) => updateField('area', v)}
          editable={!saving}
        />
        <SearchableSelect
          label="Πόλη * (από Firestore)"
          value={selectedCityId}
          options={cityOptions}
          onChange={handleCityIdChange}
          placeholder={cities.length ? 'Επίλεξε πόλη' : 'Άδεια λίστα — γέμισε πόλεις στο Admin'}
          disabled={saving || !effectiveTenantId || cities.length === 0}
          searchPlaceholder="Αναζήτηση πόλης…"
        />
        <TextInput
          style={styles.input}
          placeholder="ΤΚ *"
          placeholderTextColor="#94a3b8"
          value={form.zip}
          onChangeText={(v) => updateField('zip', v)}
          keyboardType="number-pad"
          editable={!saving}
        />
        <View style={styles.countryRow}>
          <Text style={styles.countryLabel}>Χώρα</Text>
          <Text style={styles.countryValue}>{form.country || '—'}</Text>
        </View>

        <TouchableOpacity
          style={[styles.verifyButton, (saving || geocoding) && styles.buttonDisabled]}
          onPress={() => void verifyAddress()}
          disabled={saving || geocoding}
        >
          {geocoding ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.verifyButtonText}>Επαλήθευση διεύθυνσης (χάρτης)</Text>
          )}
        </TouchableOpacity>

        {geocodeHint ? <Text style={styles.geocodeHint}>{geocodeHint}</Text> : null}

        <Text style={styles.mapHelp}>
          Χάρτης: πάτημα ή σύρσιμο marker. Οι συντεταγμένες αποθηκεύονται στο root του εγγράφου χρήστη.
        </Text>
        <View style={styles.mapContainer}>
          <MapView style={styles.map} region={region} onPress={handleMapPress}>
            {latitude != null && longitude != null && (
              <Marker
                coordinate={{ latitude, longitude }}
                draggable
                onDragEnd={(e) => {
                  const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
                  onPinMoved(lat, lng);
                }}
              />
            )}
          </MapView>
          <TouchableOpacity
            style={styles.locationButton}
            onPress={() => void useCurrentLocation()}
            disabled={saving}
          >
            <MapPin size={20} color="#fff" />
            <Text style={styles.locationButtonText}>Τρέχουσα τοποθεσία</Text>
          </TouchableOpacity>
        </View>
        {(geocoding || saving) && <Text style={styles.coordsText}>Ενημέρωση τοποθεσίας…</Text>}
        {latitude != null && longitude != null && !geocoding && (
          <Text style={styles.coordsText}>
            Τελικές συντεταγμένες: {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </Text>
        )}

        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Στοιχεία επικοινωνίας</Text>
        <TextInput
          style={styles.input}
          placeholder="Όνομα *"
          placeholderTextColor="#94a3b8"
          value={form.firstName}
          onChangeText={(v) => updateField('firstName', v)}
          autoCapitalize="words"
          editable={!saving}
        />
        <TextInput
          style={styles.input}
          placeholder="Επώνυμο *"
          placeholderTextColor="#94a3b8"
          value={form.lastName}
          onChangeText={(v) => updateField('lastName', v)}
          autoCapitalize="words"
          editable={!saving}
        />
        <TextInput
          style={styles.input}
          placeholder="Email (προαιρετικό — χωρίς Auth λογαριασμό)"
          placeholderTextColor="#94a3b8"
          value={form.email}
          onChangeText={(v) => updateField('email', v)}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!saving}
        />
        <TextInput
          style={styles.input}
          placeholder="Τηλέφωνο *"
          placeholderTextColor="#94a3b8"
          value={form.phone}
          onChangeText={(v) => updateField('phone', v)}
          keyboardType="phone-pad"
          editable={!saving}
        />

        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Στοιχεία επιχείρησης</Text>
        <TextInput
          style={styles.input}
          placeholder="Επωνυμία επιχείρησης *"
          placeholderTextColor="#94a3b8"
          value={form.businessName}
          onChangeText={(v) => updateField('businessName', v)}
          editable={!saving}
        />
        <TextInput
          style={styles.input}
          placeholder="ΑΦΜ (9 ψηφία) *"
          placeholderTextColor="#94a3b8"
          value={form.vat}
          onChangeText={(v) => updateField('vat', v)}
          keyboardType="number-pad"
          maxLength={9}
          editable={!saving}
        />
        <SearchableSelect
          label="Επάγγελμα * (από Firestore)"
          value={form.profession}
          options={professionOptions}
          onChange={(v) => updateField('profession', v)}
          placeholder={
            professionNames.length ? 'Επίλεξε επάγγελμα' : 'Άδεια λίστα — γέμισε επαγγέλματα στο Admin'
          }
          disabled={saving || !effectiveTenantId || professionNames.length === 0}
          searchPlaceholder="Αναζήτηση επαγγέλματος…"
        />
        <TextInput
          style={styles.input}
          placeholder="Ιστότοπος"
          placeholderTextColor="#94a3b8"
          value={form.website}
          onChangeText={(v) => updateField('website', v)}
          keyboardType="url"
          autoCapitalize="none"
          editable={!saving}
        />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Βιογραφικό"
          placeholderTextColor="#94a3b8"
          value={form.bio}
          onChangeText={(v) => updateField('bio', v)}
          multiline
          numberOfLines={3}
          editable={!saving}
        />

        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Υπηρεσία (προαιρετικό)</Text>
        <Text style={styles.hintSmall}>
          Τρόπος χρέωσης, τιμή, εκτίμηση χρόνου — όπως στη φόρμα εγγραφής.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Όνομα υπηρεσίας"
          placeholderTextColor="#94a3b8"
          value={form.serviceName}
          onChangeText={(v) => updateField('serviceName', v)}
          editable={!saving}
        />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Περιγραφή"
          placeholderTextColor="#94a3b8"
          value={form.serviceDesc}
          onChangeText={(v) => updateField('serviceDesc', v)}
          multiline
          editable={!saving}
        />
        <Text style={styles.subSectionLabel}>Τρόπος χρέωσης</Text>
        <View style={styles.profileTypeRow}>
          {SERVICE_PRICE_BASIS_CHIPS.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.profileTypeChip,
                form.servicePriceBasis === key && styles.profileTypeChipActive,
              ]}
              onPress={() =>
                setForm((prev) => ({
                  ...prev,
                  servicePriceBasis: key,
                }))
              }
              disabled={saving}
            >
              <Text
                style={[
                  styles.profileTypeChipText,
                  form.servicePriceBasis === key && styles.profileTypeChipTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={styles.input}
          placeholder={servicePricePlaceholder(form.servicePriceBasis)}
          placeholderTextColor="#94a3b8"
          value={form.servicePrice}
          onChangeText={(v) => updateField('servicePrice', v)}
          keyboardType="decimal-pad"
          editable={!saving}
        />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Εκτίμηση χρόνου / εύρους (προαιρετικό)"
          placeholderTextColor="#94a3b8"
          value={form.serviceTimeEstimate}
          onChangeText={(v) => updateField('serviceTimeEstimate', v)}
          multiline
          editable={!saving}
        />

        <TouchableOpacity
          style={[styles.primary, saving && styles.primaryDisabled]}
          onPress={() => void handleSave()}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>Αποθήκευση επαγγελματία</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { flex: 1 },
  section: { padding: 16, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f8fafc' },
  warn: { fontSize: 15, color: '#b45309', textAlign: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  sub: { fontSize: 13, color: '#64748b', lineHeight: 19, marginBottom: 10 },
  trialBanner: {
    padding: 12,
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    marginBottom: 14,
  },
  trialBannerTitle: { fontSize: 14, fontWeight: '700', color: '#047857' },
  trialBannerText: { fontSize: 12, color: '#166534', marginTop: 6, lineHeight: 17 },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), color: '#047857' },
  block: { marginBottom: 12 },
  hint: { fontSize: 12, color: '#64748b', marginBottom: 8, lineHeight: 18 },
  hintSmall: { fontSize: 11, color: '#94a3b8', marginBottom: 8, lineHeight: 16 },
  geocodeHint: { fontSize: 12, color: '#2563eb', marginBottom: 8, lineHeight: 18 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 4 },
  subSectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 4,
    marginBottom: 6,
  },
  profileTypeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  profileTypeChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  profileTypeChipActive: {
    backgroundColor: '#d1fae5',
    borderColor: '#059669',
  },
  profileTypeChipText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  profileTypeChipTextActive: { color: '#047857' },
  photoButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
  },
  photoPlaceholderWithIcon: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#059669',
    padding: 8,
  },
  photoPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoTextOnGreen: { fontSize: 11, color: '#ecfdf5', marginTop: 8, textAlign: 'center' },
  mapHelp: { fontSize: 12, color: '#475569', lineHeight: 17, marginBottom: 8 },
  mapContainer: { height: 200, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  map: { width: '100%', height: '100%' },
  locationButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  locationButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  coordsText: { fontSize: 12, color: '#64748b', marginTop: 6 },
  verifyButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  verifyButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonDisabled: { opacity: 0.7 },
  countryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  countryLabel: { fontSize: 14, fontWeight: '600', color: '#475569' },
  countryValue: { fontSize: 16, color: '#0f172a' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0f172a',
    marginBottom: 10,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  primary: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryDisabled: { opacity: 0.7 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  toast: {
    backgroundColor: '#d1fae5',
    borderWidth: 1,
    borderColor: '#6ee7b7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  toastText: { color: '#065f46', fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
