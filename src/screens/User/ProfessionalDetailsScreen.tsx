/**
 * Professional details - profile, map, services, reviews (φίλοι / λοιπά), Contact modal
 * Χάρτης: lat/lng απευθείας από το Firestore (όχι τυχαία τιμή).
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';
import { MapPin, Phone, Star, CalendarPlus } from 'lucide-react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../api';
import { normalizeUserProfileFromFirestore } from '../../api/userDocument';
import type { Professional, Review, User } from '../../api/types';
import { mapImportedProfessionalDoc } from '../../utils/importedProfessional';
import { getProfileImageUri } from '../../utils/imageUtils';
import { formatServicePriceAndEstimate } from '../../utils/servicePricing';
import {
  getProfessionalAvatarKind,
  ProfessionalAvatarIcon,
} from '../../assets/avatars';
import { useAuth } from '../../context/AuthContext';
import { fetchReviewsForProfessional } from '../../api/reviews';
import { RateReviewModal } from '../../components/RateReviewModal';
import { CommunicationModal } from '../../components/CommunicationModal';
import { navigateToChat } from '../../utils/navigateToChat';
import { createAppointmentRequest } from '../../api/appointmentRequests';

function formatReviewWhen(t: Review['timestamp']): string {
  if (t == null) return '';
  try {
    if (typeof t === 'object' && 'toDate' in t && typeof (t as { toDate: () => Date }).toDate === 'function') {
      return (t as { toDate: () => Date }).toDate().toLocaleDateString('el-GR');
    }
    if (typeof t === 'object' && 'seconds' in t && typeof (t as { seconds: number }).seconds === 'number') {
      return new Date((t as { seconds: number }).seconds * 1000).toLocaleDateString('el-GR');
    }
    if (t instanceof Date) return t.toLocaleDateString('el-GR');
  } catch {
    /* ignore */
  }
  return '';
}

export default function ProfessionalDetailsScreen() {
  const route = useRoute<RouteProp<{ ProfessionalDetails: { professional: Professional } }, 'ProfessionalDetails'>>();
  const { professional: routePro } = route.params;
  const navigation = useNavigation();
  const { user, userProfile } = useAuth();
  const [professional, setProfessional] = useState<Professional>(routePro);
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [rateModalVisible, setRateModalVisible] = useState(false);

  const myFriendIds = useMemo(() => {
    if (!userProfile || userProfile.role !== 'user') return new Set<string>();
    const u = userProfile as User;
    const f = u.friends;
    if (!Array.isArray(f)) return new Set<string>();
    return new Set(f.filter((x): x is string => typeof x === 'string'));
  }, [userProfile]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (routePro.imported) {
          const snap = await getDoc(doc(db, 'importedProfessionals', routePro.uid));
          if (!snap.exists() || cancelled) return;
          setProfessional(
            mapImportedProfessionalDoc(routePro.uid, snap.data() as Record<string, unknown>)
          );
          return;
        }
        const snap = await getDoc(doc(db, 'users', routePro.uid));
        if (!snap.exists() || cancelled) return;
        const merged = normalizeUserProfileFromFirestore(
          routePro.uid,
          snap.data() as Record<string, unknown>
        ) as Professional;
        setProfessional(merged);
      } catch {
        /* κρατάμε route params */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routePro.uid, routePro.imported]);

  const reloadReviews = useCallback(async () => {
    setReviewsLoading(true);
    try {
      const list = await fetchReviewsForProfessional(professional.uid);
      setReviews(list);
    } catch {
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  }, [professional.uid]);

  useEffect(() => {
    void reloadReviews();
  }, [reloadReviews]);

  const { friendReviews, otherReviews } = useMemo(() => {
    const fr: Review[] = [];
    const ot: Review[] = [];
    for (const r of reviews) {
      if (myFriendIds.has(r.userId)) fr.push(r);
      else ot.push(r);
    }
    return { friendReviews: fr, otherReviews: ot };
  }, [reviews, myFriendIds]);

  const canRate =
    user &&
    userProfile?.role === 'user' &&
    user.uid !== professional.uid;

  const canRequestAppointment =
    Boolean(user) &&
    userProfile?.role === 'user' &&
    user?.uid !== professional.uid &&
    !professional.imported;

  const reviewerDisplayName =
    userProfile?.role === 'user'
      ? `${(userProfile as User).firstName ?? ''} ${(userProfile as User).lastName ?? ''}`.trim() || 'Χρήστης'
      : 'Χρήστης';

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

  const requestAppointment = () => {
    if (!user) return;
    const tomorrow = Date.now() + 86400000;
    Alert.alert(
      'Αίτημα ραντεβού',
      'Θα σταλεί αίτημα ραντεβού (ημερομηνία/ώρα προεπιλογής: αύριο). Ο επαγγελματίας θα ειδοποιηθεί.',
      [
        { text: 'Άκυρο', style: 'cancel' },
        {
          text: 'Αποστολή',
          onPress: async () => {
            try {
              await createAppointmentRequest(user.uid, professional.uid, tomorrow);
              Alert.alert('Εστάλη', 'Το αίτημα ραντεβού στάλθηκε στον επαγγελματία.');
            } catch (e) {
              Alert.alert('Σφάλμα', e instanceof Error ? e.message : 'Αποτυχία.');
            }
          },
        },
      ]
    );
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
        <View style={styles.ratingRow}>
          <Star size={18} color="#f59e0b" fill="#fbbf24" />
          <Text style={styles.ratingText}>
            {(professional.ratingAvg ?? 0).toFixed(1)} · {(professional.totalReviews ?? 0) === 1 ? '1 αξιολόγηση' : `${professional.totalReviews ?? 0} αξιολογήσεις`}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => setContactModalVisible(true)}
          >
            <Phone size={18} color="#fff" />
            <Text style={styles.contactButtonText}>Επικοινωνία</Text>
          </TouchableOpacity>
          {canRate ? (
            <TouchableOpacity style={styles.rateButton} onPress={() => setRateModalVisible(true)}>
              <Star size={18} color="#059669" />
              <Text style={styles.rateButtonText}>Βαθμολόγηση</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {canRequestAppointment ? (
          <TouchableOpacity style={styles.appointmentBtn} onPress={requestAppointment}>
            <CalendarPlus size={18} color="#fff" />
            <Text style={styles.appointmentBtnText}>Αίτημα ραντεβού</Text>
          </TouchableOpacity>
        ) : null}
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
              <Text style={styles.servicePrice}>{formatServicePriceAndEstimate(s)}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Κριτικές</Text>
        {reviewsLoading ? (
          <ActivityIndicator color="#059669" style={{ marginVertical: 16 }} />
        ) : (
          <>
            {friendReviews.length > 0 ? (
              <>
                <Text style={styles.subsectionTitle}>Από φίλους σου</Text>
                {friendReviews.map((r) => (
                  <View key={r.id ?? `${r.userId}-${r.timestamp}`} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <Text style={styles.reviewName}>{r.reviewerName?.trim() || 'Χρήστης'}</Text>
                      <Text style={styles.reviewStars}>{'★'.repeat(Math.min(5, Math.max(0, Math.round(r.stars))))}</Text>
                    </View>
                    {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
                    {formatReviewWhen(r.timestamp) ? (
                      <Text style={styles.reviewDate}>{formatReviewWhen(r.timestamp)}</Text>
                    ) : null}
                  </View>
                ))}
              </>
            ) : null}
            {otherReviews.length > 0 ? (
              <>
                <Text style={[styles.subsectionTitle, friendReviews.length > 0 && styles.subsectionSpaced]}>
                  Άλλες κριτικές
                </Text>
                {otherReviews.map((r) => (
                  <View key={r.id ?? `${r.userId}-${r.timestamp}`} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <Text style={styles.reviewName}>{r.reviewerName?.trim() || 'Χρήστης'}</Text>
                      <Text style={styles.reviewStars}>{'★'.repeat(Math.min(5, Math.max(0, Math.round(r.stars))))}</Text>
                    </View>
                    {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
                    {formatReviewWhen(r.timestamp) ? (
                      <Text style={styles.reviewDate}>{formatReviewWhen(r.timestamp)}</Text>
                    ) : null}
                  </View>
                ))}
              </>
            ) : null}
            {!reviewsLoading && friendReviews.length === 0 && otherReviews.length === 0 ? (
              <Text style={styles.noReviews}>Δεν υπάρχουν ακόμη δημόσιες κριτικές.</Text>
            ) : null}
          </>
        )}
      </View>

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

      <CommunicationModal
        visible={contactModalVisible}
        professional={contactModalVisible ? professional : null}
        onClose={() => setContactModalVisible(false)}
        canUseChat={!professional.imported}
        onOpenChat={(pro) =>
          navigateToChat(navigation as unknown as NavigationProp<ParamListBase>, pro)
        }
      />

      {canRate && user ? (
        <RateReviewModal
          visible={rateModalVisible}
          onClose={() => setRateModalVisible(false)}
          professional={professional}
          reviewerId={user.uid}
          reviewerName={reviewerDisplayName}
          onSubmitted={async () => {
            await reloadReviews();
            try {
              if (professional.imported) {
                const snap = await getDoc(doc(db, 'importedProfessionals', professional.uid));
                if (snap.exists()) {
                  setProfessional(mapImportedProfessionalDoc(professional.uid, snap.data() as Record<string, unknown>));
                }
              } else {
                const snap = await getDoc(doc(db, 'users', professional.uid));
                if (snap.exists()) {
                  setProfessional(
                    normalizeUserProfileFromFirestore(
                      professional.uid,
                      snap.data() as Record<string, unknown>
                    ) as Professional
                  );
                }
              }
            } catch {
              /* keep UI */
            }
          }}
        />
      ) : null}
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
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  ratingText: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 16,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  contactButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#059669',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  rateButtonText: { color: '#059669', fontSize: 16, fontWeight: '700' },
  appointmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    backgroundColor: '#0f172a',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    maxWidth: 320,
  },
  appointmentBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  section: { padding: 24, marginTop: 12, backgroundColor: '#fff' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 12 },
  subsectionTitle: { fontSize: 14, fontWeight: '700', color: '#059669', marginBottom: 10 },
  subsectionSpaced: { marginTop: 16 },
  reviewCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  reviewName: { fontSize: 15, fontWeight: '700', color: '#0f172a', flex: 1, marginRight: 8 },
  reviewStars: { fontSize: 14, color: '#f59e0b' },
  reviewComment: { fontSize: 14, color: '#475569', lineHeight: 20 },
  reviewDate: { fontSize: 12, color: '#94a3b8', marginTop: 8 },
  noReviews: { fontSize: 14, color: '#94a3b8', fontStyle: 'italic' },
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
});
