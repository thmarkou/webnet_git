/**
 * Registration screen for professionals
 * Photo, Map + συγχρονισμός διεύθυνσης ↔ pin (geocode / reverse geocode)
 */
import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Briefcase, MapPin } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import { FormSelect } from '../components/FormSelect';
import { matchCityFromGeocode } from '../constants/data';
import { useFirestoreCatalog } from '../hooks/useFirestoreCatalog';
import type { ProfileDisplayType, ServicePriceBasis } from '../api/types';
import { SERVICE_PRICE_BASIS_CHIPS } from '../utils/servicePricing';
import {
  profileDisplayTypeToAvatarKind,
  ProfessionalAvatarIcon,
} from '../assets/avatars';
import { AppUiBuildRibbon } from '../components/AppUiBuildRibbon';

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  RegisterUser: undefined;
  RegisterProfessional: undefined;
};

/** Zoom όταν επιλέγεις πόλη / γενική θέα */
const MAP_DELTA_WIDE = { latitudeDelta: 0.06, longitudeDelta: 0.06 };
/** Zoom μετά από επιτυχές geocode ή μετακίνηση pin — ακριβέστερο σημείο */
const MAP_DELTA_PRECISE = { latitudeDelta: 0.004, longitudeDelta: 0.004 };

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

export default function RegisterProfessionalScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { signUpProfessional } = useAuth();
  const { cities, cityLabels, professions } = useFirestoreCatalog();
  const trialEndPreview = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric' });
  }, []);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [profileImageBase64, setProfileImageBase64] = useState<string | null>(null);
  const [region, setRegion] = useState({
    latitude: 37.9838,
    longitude: 23.7275,
    ...MAP_DELTA_WIDE,
  });
  const [geocodeHint, setGeocodeHint] = useState<string | null>(null);
  const [profileDisplayType, setProfileDisplayType] = useState<ProfileDisplayType>('male');
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const updatingFromMapRef = useRef(false);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
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

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const moveMapTo = useCallback((lat: number, lng: number, mode: 'wide' | 'precise' = 'precise') => {
    const d = mode === 'wide' ? MAP_DELTA_WIDE : MAP_DELTA_PRECISE;
    setRegion({
      latitude: lat,
      longitude: lng,
      ...d,
    });
  }, []);

  /** Reverse geocode → πεδία φόρμας (μετά από μετακίνηση pin) */
  const applyReverseGeocode = useCallback(
    async (lat: number, lng: number) => {
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
        // αγνοούμε — offline / limit
      } finally {
        setGeocoding(false);
        setTimeout(() => {
          updatingFromMapRef.current = false;
        }, 150);
      }
    },
    []
  );

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

  /** Κουμπί «Επαλήθευση»: geocodeAsync → μετακίνηση pin για οπτικό έλεγχο πριν την υποβολή */
  const verifyAddress = useCallback(async () => {
    const { address, addressNumber, city, country, zip, area } = form;
    if (!city.trim() || !address.trim()) {
      Alert.alert('Συμπλήρωσε οδό και πόλη.');
      return;
    }
    if (!zip.trim()) {
      Alert.alert('Συμπλήρωσε ΤΚ', 'Ο ταχυδρομικός κώδικας βοηθά το geocoding να βρει το ακριβές σημείο.');
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
          'Δεν βρέθηκε σημείο — όρισε το pin στον χάρτη (πάτημα / σύρσιμο) ή «Τρέχουσα τοποθεσία».'
        );
      }
    } catch {
      setGeocodeHint('Αποτυχία geocoding — όρισε το pin χειροκίνητα στον χάρτη.');
    } finally {
      setGeocoding(false);
    }
  }, [form, moveMapTo]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Άρνηση πρόσβασης', 'Χρειάζεται πρόσβαση στη φωτογραφική σου συλλογή.');
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
      Alert.alert('Άρνηση πρόσβασης', 'Χρειάζεται πρόσβαση στην τοποθεσία σου.');
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

  const handleCitySelect = (cityLabel: string) => {
    const c = cities.find((x) => x.label === cityLabel);
    setForm((prev) => ({
      ...prev,
      city: cityLabel,
      country: c?.country ?? prev.country,
    }));
    if (c) {
      setLatitude(c.latitude);
      setLongitude(c.longitude);
      moveMapTo(c.latitude, c.longitude, 'wide');
      setGeocodeHint('Επίλεξε οδό και αριθμό για ακριβές σημείο, ή μετακίνησε το pin.');
    }
  };

  const handleSubmit = async () => {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      businessName,
      vat,
      address,
      profession,
      city,
    } = form;

    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !email.trim() ||
      !password ||
      !businessName.trim() ||
      !vat.trim() ||
      !address.trim() ||
      !form.addressNumber.trim() ||
      !form.zip.trim() ||
      !profession ||
      !city
    ) {
      Alert.alert(
        'Σφάλμα',
        'Συμπλήρωσε τα υποχρεωτικά: Όνομα, Επώνυμο, Email, Κωδικός, Επωνυμία, ΑΦΜ, Οδός, Αριθμός, ΤΚ, Επάγγελμα, Πόλη — και όρισε pin στον χάρτη.'
      );
      return;
    }

    if (vat.length !== 9) {
      Alert.alert('Σφάλμα', 'Το ΑΦΜ πρέπει να έχει 9 ψηφία.');
      return;
    }

    if (latitude == null || longitude == null) {
      Alert.alert(
        'Σφάλμα',
        'Όρισε τοποθεσία: πάτησε «Επαλήθευση διεύθυνσης», ή πάτησε στον χάρτη, ή «Τρέχουσα τοποθεσία», και σύρε το pin αν χρειάζεται.'
      );
      return;
    }

    setLoading(true);
    try {
      await signUpProfessional({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Σφάλμα εγγραφής';
      Alert.alert('Σφάλμα', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <AppUiBuildRibbon />
          <Briefcase size={48} color="#059669" strokeWidth={2} />
          <Text style={styles.title}>Εγγραφή Επαγγελματία</Text>
          <Text style={styles.subtitle}>Δημιούργησε λογαριασμό ως επαγγελματίας</Text>
          <View style={styles.trialBanner}>
            <Text style={styles.trialBannerTitle}>Δοκιμαστική περίοδος 30 ημερών</Text>
            <Text style={styles.trialBannerText}>
              Με την ολοκλήρωση εγγραφής ξεκινά δωρεάν trial. Ενδεικτική ημερομηνία λήξης αν
              εγγραφείς σήμερα: {trialEndPreview} (αποθηκεύεται αυτόματα στο Firestore ως trialEndDate).
            </Text>
          </View>
        </View>

        <View style={styles.form}>
          <Text style={styles.sectionLabel}>Τύπος προφίλ *</Text>
          <Text style={styles.hintSmall}>
            Αν δεν ανεβάσεις φωτογραφία, εμφανίζεται το αντίστοιχο εικονίδιο (άνδρας / γυναίκα / εταιρεία).
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
                disabled={loading}
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
          <TouchableOpacity
            style={styles.photoButton}
            onPress={pickImage}
            disabled={loading}
          >
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
            Συμπλήρωσε οδό, αριθμό, ΤΚ και πόλη· πάτα «Επαλήθευση διεύθυνσης» για geocode και εμφάνιση pin. Σύρε
            το pin στο ακριβές σημείο πριν την εγγραφή — αυτές οι συντεταγμένες αποθηκεύονται στο Firestore.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Διεύθυνση (οδός) *"
            placeholderTextColor="#94a3b8"
            value={form.address}
            onChangeText={(v) => updateField('address', v)}
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Αριθμός *"
            placeholderTextColor="#94a3b8"
            value={form.addressNumber}
            onChangeText={(v) => updateField('addressNumber', v)}
            keyboardType="default"
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Περιοχή"
            placeholderTextColor="#94a3b8"
            value={form.area}
            onChangeText={(v) => updateField('area', v)}
            editable={!loading}
          />
          <FormSelect
            label="Πόλη *"
            value={form.city}
            options={cityLabels}
            onChange={handleCitySelect}
            placeholder="Επίλεξε πόλη"
            disabled={loading}
          />
          <TextInput
            style={styles.input}
            placeholder="ΤΚ *"
            placeholderTextColor="#94a3b8"
            value={form.zip}
            onChangeText={(v) => updateField('zip', v)}
            keyboardType="number-pad"
            editable={!loading}
          />
          <View style={styles.countryRow}>
            <Text style={styles.countryLabel}>Χώρα</Text>
            <Text style={styles.countryValue}>{form.country || '—'}</Text>
          </View>

          <TouchableOpacity
            style={[styles.verifyButton, (loading || geocoding) && styles.buttonDisabled]}
            onPress={() => void verifyAddress()}
            disabled={loading || geocoding}
          >
            {geocoding ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.verifyButtonText}>Επαλήθευση διεύθυνσης (χάρτης)</Text>
            )}
          </TouchableOpacity>

          {geocodeHint ? <Text style={styles.geocodeHint}>{geocodeHint}</Text> : null}

          <Text style={styles.mapHelp}>
            Χάρτης: πάτησε για pin ή σύρε το marker στην ακριβή θέση (πόρτα). Οι τιμές latitude /
            longitude αποθηκεύονται ως αριθμοί στο root του εγγράφου Firestore — όχι μέσα σε friends.
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
              onPress={useCurrentLocation}
              disabled={loading}
            >
              <MapPin size={20} color="#fff" />
              <Text style={styles.locationButtonText}>Τρέχουσα τοποθεσία</Text>
            </TouchableOpacity>
          </View>
          {(geocoding || loading) && (
            <Text style={styles.coordsText}>Ενημέρωση τοποθεσίας…</Text>
          )}
          {latitude != null && longitude != null && !geocoding && (
            <Text style={styles.coordsText}>
              Τελικές συντεταγμένες (αποθήκευση): {latitude.toFixed(6)}, {longitude.toFixed(6)}
            </Text>
          )}

          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Στοιχεία λογαριασμού</Text>
          <TextInput
            style={styles.input}
            placeholder="Όνομα *"
            placeholderTextColor="#94a3b8"
            value={form.firstName}
            onChangeText={(v) => updateField('firstName', v)}
            autoCapitalize="words"
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Επώνυμο *"
            placeholderTextColor="#94a3b8"
            value={form.lastName}
            onChangeText={(v) => updateField('lastName', v)}
            autoCapitalize="words"
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Email *"
            placeholderTextColor="#94a3b8"
            value={form.email}
            onChangeText={(v) => updateField('email', v)}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Τηλέφωνο"
            placeholderTextColor="#94a3b8"
            value={form.phone}
            onChangeText={(v) => updateField('phone', v)}
            keyboardType="phone-pad"
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Κωδικός *"
            placeholderTextColor="#94a3b8"
            value={form.password}
            onChangeText={(v) => updateField('password', v)}
            secureTextEntry
            editable={!loading}
          />

          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Στοιχεία επιχείρησης</Text>
          <TextInput
            style={styles.input}
            placeholder="Επωνυμία επιχείρησης *"
            placeholderTextColor="#94a3b8"
            value={form.businessName}
            onChangeText={(v) => updateField('businessName', v)}
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="ΑΦΜ (9 ψηφία) *"
            placeholderTextColor="#94a3b8"
            value={form.vat}
            onChangeText={(v) => updateField('vat', v)}
            keyboardType="number-pad"
            maxLength={9}
            editable={!loading}
          />
          <FormSelect
            label="Επάγγελμα *"
            value={form.profession}
            options={professions}
            onChange={(v) => updateField('profession', v)}
            placeholder="Επίλεξε επάγγελμα"
            disabled={loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Ιστότοπος"
            placeholderTextColor="#94a3b8"
            value={form.website}
            onChangeText={(v) => updateField('website', v)}
            keyboardType="url"
            autoCapitalize="none"
            editable={!loading}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Βιογραφικό"
            placeholderTextColor="#94a3b8"
            value={form.bio}
            onChangeText={(v) => updateField('bio', v)}
            multiline
            numberOfLines={3}
            editable={!loading}
          />

          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Υπηρεσία (προαιρετικό)</Text>
          <Text style={styles.hintSmall}>
            Πώς χρεώνεις: σταθερό ποσό, ανά ώρα, ανά επίσκεψη ή κατόπιν εκτίμησης. Στην εκτίμηση χρόνου
            περιέγραψε ελεύθερα (π.χ. «2–4 ώρες», «ανάλογα τη βλάβη», «1 ημέρα»).
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Όνομα υπηρεσίας"
            placeholderTextColor="#94a3b8"
            value={form.serviceName}
            onChangeText={(v) => updateField('serviceName', v)}
            editable={!loading}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Περιγραφή"
            placeholderTextColor="#94a3b8"
            value={form.serviceDesc}
            onChangeText={(v) => updateField('serviceDesc', v)}
            multiline
            editable={!loading}
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
                disabled={loading}
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
            editable={!loading}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Εκτίμηση χρόνου / εύρους (προαιρετικό)"
            placeholderTextColor="#94a3b8"
            value={form.serviceTimeEstimate}
            onChangeText={(v) => updateField('serviceTimeEstimate', v)}
            multiline
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Εγγραφή Επαγγελματία</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.link}
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Text style={styles.linkText}>← Επιστροφή</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { flexGrow: 1, padding: 24, paddingTop: 48, paddingBottom: 48 },
  header: { alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginTop: 12 },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  trialBanner: {
    marginTop: 16,
    padding: 14,
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  trialBannerTitle: { fontSize: 15, fontWeight: '700', color: '#047857' },
  trialBannerText: { fontSize: 13, color: '#166534', marginTop: 6, lineHeight: 19 },
  form: { gap: 12 },
  hint: { fontSize: 12, color: '#64748b', marginBottom: 8, lineHeight: 18 },
  hintSmall: { fontSize: 11, color: '#94a3b8', marginBottom: 8, lineHeight: 16 },
  geocodeHint: { fontSize: 12, color: '#2563eb', marginBottom: 8, lineHeight: 18 },
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
  verifyButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  verifyButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
  },
  subSectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 4,
    marginBottom: 6,
  },
  photoButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
  },
  photoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderWithIcon: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#059669',
    padding: 8,
  },
  photoPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoText: { fontSize: 12, color: '#64748b', marginTop: 4, textAlign: 'center' },
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
  coordsText: { fontSize: 12, color: '#64748b' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0f172a',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  inputHalf: { flex: 1 },
  countryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  countryLabel: { fontSize: 14, fontWeight: '600', color: '#475569' },
  countryValue: { fontSize: 16, color: '#0f172a' },
  button: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { alignItems: 'center', marginTop: 16 },
  linkText: { color: '#059669', fontSize: 14 },
});
