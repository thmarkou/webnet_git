/**
 * Registration screen for professionals
 * Includes: Photo upload, Map with location pin, all business fields
 */
import React, { useState } from 'react';
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
import { Briefcase, Camera, MapPin } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuth } from '../../context/AuthContext';

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  RegisterUser: undefined;
  RegisterProfessional: undefined;
};

const DEFAULT_REGION = {
  latitude: 37.9838,
  longitude: 23.7275,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function RegisterProfessionalScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { signUpProfessional } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [profileImageBase64, setProfileImageBase64] = useState<string | null>(null);
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
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
    country: '',
    serviceName: '',
    serviceDesc: '',
    serviceDuration: '',
    servicePrice: '',
  });

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

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
    const loc = await Location.getCurrentPositionAsync({});
    const { latitude: lat, longitude: lng } = loc.coords;
    setLatitude(lat);
    setLongitude(lng);
    setRegion({
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  };

  const handleMapPress = (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
    setLatitude(lat);
    setLongitude(lng);
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
    } = form;

    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !email.trim() ||
      !password ||
      !businessName.trim() ||
      !vat.trim() ||
      !address.trim()
    ) {
      Alert.alert(
        'Σφάλμα',
        'Συμπλήρωσε τα υποχρεωτικά πεδία: Όνομα, Επώνυμο, Email, Κωδικός, Επωνυμία Επιχείρησης, ΑΦΜ, Διεύθυνση.'
      );
      return;
    }

    if (vat.length !== 9) {
      Alert.alert('Σφάλμα', 'Το ΑΦΜ πρέπει να έχει 9 ψηφία.');
      return;
    }

    setLoading(true);
    setUploadingPhoto(false);
    try {
      await signUpProfessional({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        profession: form.profession.trim(),
        location: form.city.trim(),
        businessName: businessName.trim(),
        vat: vat.trim(),
        website: form.website.trim(),
        bio: form.bio.trim(),
        address: address.trim(),
        addressNumber: form.addressNumber.trim(),
        area: form.area.trim(),
        zip: form.zip.trim(),
        city: form.city.trim(),
        country: form.country.trim(),
        profileImageBase64: profileImageBase64 ?? undefined,
        latitude,
        longitude,
        serviceName: form.serviceName.trim(),
        serviceDesc: form.serviceDesc.trim(),
        serviceDuration: parseInt(form.serviceDuration, 10) || 0,
        servicePrice: parseFloat(form.servicePrice) || 0,
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
          <Briefcase size={48} color="#059669" strokeWidth={2} />
          <Text style={styles.title}>Εγγραφή Επαγγελματία</Text>
          <Text style={styles.subtitle}>
            Δημιούργησε λογαριασμό ως επαγγελματίας
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.sectionLabel}>Φωτογραφία προφίλ</Text>
          <TouchableOpacity
            style={styles.photoButton}
            onPress={pickImage}
            disabled={loading}
          >
            {profileImageUri ? (
              <Image source={{ uri: profileImageUri }} style={styles.photoPreview} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Camera size={40} color="#94a3b8" />
                <Text style={styles.photoText}>
                  Ανέβασε φωτογραφία προφίλ
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Τοποθεσία στον χάρτη</Text>
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              region={region}
              onRegionChangeComplete={setRegion}
              onPress={handleMapPress}
            >
              {(latitude != null && longitude != null) && (
                <Marker
                  coordinate={{ latitude, longitude }}
                  draggable
                  onDragEnd={(e) => {
                    const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
                    setLatitude(lat);
                    setLongitude(lng);
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
          {(latitude != null && longitude != null) && (
            <Text style={styles.coordsText}>
              Συντεταγμένες: {latitude.toFixed(5)}, {longitude.toFixed(5)}
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
          <TextInput
            style={styles.input}
            placeholder="Επάγγελμα"
            placeholderTextColor="#94a3b8"
            value={form.profession}
            onChangeText={(v) => updateField('profession', v)}
            editable={!loading}
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
          <TextInput
            style={styles.input}
            placeholder="Διεύθυνση *"
            placeholderTextColor="#94a3b8"
            value={form.address}
            onChangeText={(v) => updateField('address', v)}
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Αριθμός"
            placeholderTextColor="#94a3b8"
            value={form.addressNumber}
            onChangeText={(v) => updateField('addressNumber', v)}
            keyboardType="number-pad"
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
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.inputHalf]}
              placeholder="ΤΚ"
              placeholderTextColor="#94a3b8"
              value={form.zip}
              onChangeText={(v) => updateField('zip', v)}
              keyboardType="number-pad"
              editable={!loading}
            />
            <TextInput
              style={[styles.input, styles.inputHalf]}
              placeholder="Πόλη"
              placeholderTextColor="#94a3b8"
              value={form.city}
              onChangeText={(v) => updateField('city', v)}
              editable={!loading}
            />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Χώρα"
            placeholderTextColor="#94a3b8"
            value={form.country}
            onChangeText={(v) => updateField('country', v)}
            editable={!loading}
          />

          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Υπηρεσία (προαιρετικό)</Text>
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
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.inputHalf]}
              placeholder="Διάρκεια (λεπτά)"
              placeholderTextColor="#94a3b8"
              value={form.serviceDuration}
              onChangeText={(v) => updateField('serviceDuration', v)}
              keyboardType="number-pad"
              editable={!loading}
            />
            <TextInput
              style={[styles.input, styles.inputHalf]}
              placeholder="Τιμή (€)"
              placeholderTextColor="#94a3b8"
              value={form.servicePrice}
              onChangeText={(v) => updateField('servicePrice', v)}
              keyboardType="decimal-pad"
              editable={!loading}
            />
          </View>

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
  form: { gap: 12 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
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
  photoPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoText: { fontSize: 12, color: '#64748b', marginTop: 4, textAlign: 'center' },
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
  row: { flexDirection: 'row', gap: 12 },
  inputHalf: { flex: 1 },
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
