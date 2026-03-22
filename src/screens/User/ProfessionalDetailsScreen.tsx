/**
 * Professional details - profile, map, services, Contact modal
 * Χάρτης: lat/lng απευθείας από το Firestore (όχι τυχαία τιμή).
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  Linking,
  Modal,
  Pressable,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';
import { MapPin, Phone, Mail, MessageCircle } from 'lucide-react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../api';
import type { Professional } from '../../api/types';
import { getProfileImageUri } from '../../utils/imageUtils';
import {
  getProfessionalAvatarKind,
  ProfessionalAvatarIcon,
} from '../../assets/avatars';

function toCoord(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export default function ProfessionalDetailsScreen() {
  const route = useRoute<RouteProp<{ ProfessionalDetails: { professional: Professional } }, 'ProfessionalDetails'>>();
  const { professional: routePro } = route.params;
  const [professional, setProfessional] = useState<Professional>(routePro);
  const [contactModalVisible, setContactModalVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', routePro.uid));
        if (!snap.exists() || cancelled) return;
        const d = snap.data() as Record<string, unknown>;
        const lat = toCoord(d.latitude);
        const lng = toCoord(d.longitude);
        // Μόνο συντεταγμένες από Firestore — αποφεύγουμε spread όλου του doc (Timestamps κ.λπ.)
        setProfessional((prev) => ({
          ...prev,
          latitude: lat ?? prev.latitude,
          longitude: lng ?? prev.longitude,
        }));
      } catch {
        /* κρατάμε route params */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routePro.uid]);

  const imageUri = getProfileImageUri(professional);
  const avatarKind = getProfessionalAvatarKind(professional);

  const pinLatLng = useMemo(() => {
    const lat =
      professional.latitude != null ? Number(professional.latitude) : NaN;
    const lng =
      professional.longitude != null ? Number(professional.longitude) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { latitude: lat, longitude: lng };
  }, [professional.latitude, professional.longitude]);

  const hasCoords = pinLatLng != null;

  const initialMapRegion = useMemo(
    () =>
      pinLatLng
        ? {
            latitude: pinLatLng.latitude,
            longitude: pinLatLng.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }
        : {
            latitude: 37.9838,
            longitude: 23.7275,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          },
    [pinLatLng]
  );

  const openInMaps = () => {
    if (pinLatLng) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${pinLatLng.latitude},${pinLatLng.longitude}`;
      Linking.openURL(url);
    }
  };

  const handleCall = () => {
    if (professional.phone) {
      Linking.openURL(`tel:${professional.phone}`);
    }
    setContactModalVisible(false);
  };

  const handleEmail = () => {
    if (professional.email) {
      Linking.openURL(`mailto:${professional.email}`);
    }
    setContactModalVisible(false);
  };

  const handleChat = () => {
    setContactModalVisible(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder} accessibilityLabel="Εικονίδιο προφίλ">
            <ProfessionalAvatarIcon kind={avatarKind} size={44} color="#fff" />
          </View>
        )}
        <Text style={styles.title}>
          {professional.businessName || `${professional.firstName} ${professional.lastName}`}
        </Text>
        <Text style={styles.profession}>{professional.profession || '—'}</Text>
        <TouchableOpacity
          style={styles.contactButton}
          onPress={() => setContactModalVisible(true)}
        >
          <Phone size={18} color="#fff" />
          <Text style={styles.contactButtonText}>Επικοινωνία</Text>
        </TouchableOpacity>
      </View>

      {professional.bio ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Περιγραφή</Text>
          <Text style={styles.bio}>{professional.bio}</Text>
        </View>
      ) : null}

      {professional.services?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Υπηρεσίες</Text>
          {professional.services.map((s, i) => (
            <View key={i} style={styles.serviceCard}>
              <Text style={styles.serviceName}>{s.name}</Text>
              {s.desc ? <Text style={styles.serviceDesc}>{s.desc}</Text> : null}
              <Text style={styles.servicePrice}>
                €{s.price} — {s.duration} λεπτά
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Τοποθεσία</Text>
        {professional.address && (
          <Text style={styles.address}>
            {professional.address} {professional.addressNumber}, {professional.zip} {professional.city}
          </Text>
        )}
        {hasCoords ? (
          <>
            <View style={styles.mapContainer}>
              <MapView
                key={`${professional.uid}-${pinLatLng.latitude}-${pinLatLng.longitude}`}
                style={styles.map}
                initialRegion={initialMapRegion}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
              >
                <Marker
                  coordinate={{
                    latitude: pinLatLng.latitude,
                    longitude: pinLatLng.longitude,
                  }}
                  title={professional.businessName || `${professional.firstName} ${professional.lastName}`}
                />
              </MapView>
            </View>
            <TouchableOpacity style={styles.mapButton} onPress={openInMaps}>
              <MapPin size={20} color="#fff" />
              <Text style={styles.mapButtonText}>Άνοιγμα στο Χάρτη</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.noLocation}>Δεν υπάρχουν συντεταγμένες τοποθεσίας</Text>
        )}
      </View>

      <Modal
        visible={contactModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setContactModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setContactModalVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Επικοινωνία</Text>

            {professional.phone ? (
              <TouchableOpacity style={styles.modalRow} onPress={handleCall}>
                <Phone size={24} color="#059669" />
                <Text style={styles.modalRowText}>Κάλεσμα</Text>
              </TouchableOpacity>
            ) : null}

            {professional.email ? (
              <TouchableOpacity style={styles.modalRow} onPress={handleEmail}>
                <Mail size={24} color="#059669" />
                <Text style={styles.modalRowText}>Email</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity style={styles.modalRow} onPress={handleChat}>
              <MessageCircle size={24} color="#94a3b8" />
              <Text style={[styles.modalRowText, styles.modalRowDisabled]}>Chat (σύντομα)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setContactModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>Άκυρο</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { paddingBottom: 48 },
  header: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginTop: 12 },
  profession: { fontSize: 16, color: '#059669', marginTop: 4 },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  contactButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  section: { padding: 24, marginTop: 12, backgroundColor: '#fff' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 12 },
  bio: { fontSize: 14, color: '#475569', lineHeight: 22 },
  serviceCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  serviceName: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  serviceDesc: { fontSize: 14, color: '#64748b', marginTop: 4 },
  servicePrice: { fontSize: 14, color: '#059669', marginTop: 6 },
  address: { fontSize: 14, color: '#475569', marginBottom: 12 },
  mapContainer: { height: 180, borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  map: { width: '100%', height: '100%' },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 12,
  },
  mapButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  noLocation: { fontSize: 14, color: '#64748b' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 20, textAlign: 'center' },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalRowText: { fontSize: 16, color: '#0f172a' },
  modalRowDisabled: { color: '#94a3b8' },
  modalCancel: {
    marginTop: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 16, color: '#64748b' },
});
