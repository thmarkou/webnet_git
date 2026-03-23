/**
 * Search screen — φίλτρα (Modal), Haversine απόσταση (GPS χρήστη ↔ lat/lng Firestore)
 */
import React, { useState, useEffect, useMemo, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Switch,
  ScrollView,
  Modal,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  type CollectionReference,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../../api';
import type { Professional, Review } from '../../api/types';
import { Star, SlidersHorizontal } from 'lucide-react-native';
import { haversineDistance } from '../../utils/haversine';
import { getProfileImageUri } from '../../utils/imageUtils';
import {
  getProfessionalAvatarKind,
  ProfessionalAvatarIcon,
} from '../../assets/avatars';
import { formatProfessionalAddress, minServicePrice } from '../../utils/proSearch';
import { formatSearchCardServiceLine } from '../../utils/servicePricing';
import type { SearchStackParamList } from '../../navigation/SearchStack';
import * as Location from 'expo-location';
import { useAuth } from '../../context/AuthContext';
import { FormSelect } from '../../components/FormSelect';
import { useFirestoreCatalog } from '../../hooks/useFirestoreCatalog';
import { professionDisplayForStored } from '../../utils/professionDisplay';
import { normalizeUserProfileFromFirestore } from '../../api/userDocument';
import { mapImportedProfessionalDoc } from '../../utils/importedProfessional';
import { usersProsQuery, withTenantScope } from '../../utils/tenantFirestore';
import {
  RADIUS_FILTER_OPTIONS,
  PRICE_SORT_OPTIONS,
  MIN_RATING_OPTIONS,
  type RadiusFilterKey,
  type PriceSortKey,
  type MinRatingKey,
} from '../../constants/searchFilters';

function mapDocToProfessional(id: string, data: Record<string, unknown>): Professional {
  return normalizeUserProfileFromFirestore(id, data) as Professional;
}

export default function SearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<SearchStackParamList>>();
  const { user, loading: authLoading, hasTenantDataAccess, isSuperAdmin, tenantId } = useAuth();
  const { cityLabels, professions } = useFirestoreCatalog();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myFriendIds, setMyFriendIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [filterProfession, setFilterProfession] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [radiusKey, setRadiusKey] = useState<RadiusFilterKey>('all');
  const [priceSort, setPriceSort] = useState<PriceSortKey>('none');
  const [minRatingKey, setMinRatingKey] = useState<MinRatingKey>('any');
  const [onlyAvailableToday, setOnlyAvailableToday] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const refreshUserGpsLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setUserLocation(null);
      return;
    }
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      setUserLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch {
      // Διατηρούμε προηγούμενη θέση αν υπάρχει
    }
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setFilterModalVisible(true)}
          style={styles.headerFilterBtn}
          accessibilityLabel="Φίλτρα αναζήτησης"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <SlidersHorizontal size={22} color="#2563eb" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const loadReviews = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'reviews'));
      setReviews(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            proId: data.proId,
            userId: data.userId,
            stars: data.stars,
            comment: data.comment ?? '',
            timestamp: data.timestamp,
          } as Review;
        })
      );
    } catch {
      setReviews([]);
    }
  }, []);

  useEffect(() => {
    const fetchProfessionals = async () => {
      if (authLoading) return;
      if (!hasTenantDataAccess) {
        setProfessionals([]);
        setLoading(false);
        return;
      }
      try {
        const usersRef = collection(db, 'users') as CollectionReference<DocumentData>;
        const uq = usersProsQuery(usersRef, tenantId, isSuperAdmin);
        const impRef = collection(db, 'importedProfessionals');
        const iq = withTenantScope(impRef, tenantId, isSuperAdmin);
        const [userSnap, importedSnap] = await Promise.all([
          getDocs(uq),
          getDocs(iq).catch(() => null),
        ]);
        const fromUsers = userSnap.docs.map((d) =>
          mapDocToProfessional(d.id, d.data() as Record<string, unknown>)
        );
        const fromImport =
          importedSnap && !importedSnap.empty
            ? importedSnap.docs.map((d) =>
                mapImportedProfessionalDoc(d.id, d.data() as Record<string, unknown>)
              )
            : [];
        setProfessionals([...fromUsers, ...fromImport]);
      } catch {
        setProfessionals([]);
      } finally {
        setLoading(false);
      }
    };
    void fetchProfessionals();
  }, [authLoading, hasTenantDataAccess, isSuperAdmin, tenantId]);

  useFocusEffect(
    useCallback(() => {
      void refreshUserGpsLocation();
      loadReviews();
      if (!user?.uid) {
        setMyFriendIds([]);
        return;
      }
      getDoc(doc(db, 'users', user.uid))
        .then((snap) => {
          if (!snap.exists()) {
            setMyFriendIds([]);
            return;
          }
          const n = normalizeUserProfileFromFirestore(
            user.uid,
            snap.data() as Record<string, unknown>
          );
          setMyFriendIds(n.friends ?? []);
        })
        .catch(() => setMyFriendIds([]));
    }, [user?.uid, loadReviews, refreshUserGpsLocation])
  );

  const friendBoostedProIds = useMemo(() => {
    const s = new Set<string>();
    for (const r of reviews) {
      if (myFriendIds.includes(r.userId) && r.stars >= 4) {
        s.add(r.proId);
      }
    }
    return s;
  }, [reviews, myFriendIds]);

  const distanceKm = useCallback(
    (pro: Professional): number => {
      if (!userLocation || pro.latitude == null || pro.longitude == null) {
        return Number.POSITIVE_INFINITY;
      }
      return haversineDistance(
        userLocation.latitude,
        userLocation.longitude,
        pro.latitude,
        pro.longitude
      );
    },
    [userLocation]
  );

  const filtered = useMemo(() => {
    let result = professionals;
    if (filterProfession.trim()) {
      const p = filterProfession.trim();
      result = result.filter((pro) => pro.profession === p);
    }
    if (filterCity.trim()) {
      const c = filterCity.trim();
      result = result.filter((pro) => pro.city === c);
    }

    const radiusOpt = RADIUS_FILTER_OPTIONS.find((o) => o.key === radiusKey);
    const maxKm = radiusOpt?.km;
    if (maxKm != null) {
      if (userLocation) {
        result = result.filter((pro) => {
          if (pro.latitude == null || pro.longitude == null) return false;
          return distanceKm(pro) <= maxKm;
        });
      }
    }

    if (minRatingKey === '4') {
      result = result.filter((pro) => (pro.ratingAvg ?? 0) >= 4);
    }

    if (onlyAvailableToday) {
      result = result.filter((pro) => pro.availableToday === true);
    }

    return result;
  }, [
    professionals,
    filterProfession,
    filterCity,
    radiusKey,
    userLocation,
    minRatingKey,
    onlyAvailableToday,
    distanceKm,
  ]);

  const sortedFiltered = useMemo(() => {
    const list = [...filtered];
    const comparePriceAsc = (a: Professional, b: Professional) => {
      const pa = minServicePrice(a);
      const pb = minServicePrice(b);
      const ia = pa === Number.POSITIVE_INFINITY;
      const ib = pb === Number.POSITIVE_INFINITY;
      if (ia && ib) return 0;
      if (ia) return 1;
      if (ib) return -1;
      return pa - pb;
    };

    list.sort((a, b) => {
      const boostA = friendBoostedProIds.has(a.uid) ? 1 : 0;
      const boostB = friendBoostedProIds.has(b.uid) ? 1 : 0;
      if (boostA !== boostB) return boostB - boostA;

      if (priceSort === 'asc') return comparePriceAsc(a, b);
      if (priceSort === 'desc') return comparePriceAsc(b, a);

      return distanceKm(a) - distanceKm(b);
    });
    return list;
  }, [filtered, friendBoostedProIds, priceSort, distanceKm]);

  const getDistance = (pro: Professional): string | null => {
    if (!userLocation || pro.latitude == null || pro.longitude == null) return null;
    const km = distanceKm(pro);
    if (km === Number.POSITIVE_INFINITY) return null;
    if (km < 1) return `${Math.round(km * 1000)} m away`;
    return `${km.toFixed(1)} km away`;
  };

  const radiusNeedsLocation =
    radiusKey !== 'all' && !userLocation;

  const renderItem = ({ item }: { item: Professional }) => {
    const distance = getDistance(item);
    const imageUri = getProfileImageUri(item);
    const avatarKind = getProfessionalAvatarKind(item);
    const boosted = friendBoostedProIds.has(item.uid);
    const serviceLine = formatSearchCardServiceLine(item);
    return (
      <TouchableOpacity
        style={[styles.card, boosted && styles.cardBoosted]}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('ProfessionalDetails', { professional: item })}
      >
        <View style={styles.cardRow}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder} accessibilityLabel="Εικονίδιο προφίλ">
              <ProfessionalAvatarIcon kind={avatarKind} size={26} color="#fff" />
            </View>
          )}
          <View style={styles.cardContent}>
            {boosted && (
              <View style={styles.boostBadge}>
                <Star size={14} color="#ca8a04" fill="#facc15" />
                <Text style={styles.boostText}>Πρόταση φίλου</Text>
              </View>
            )}
            <Text style={styles.cardTitle}>
              {item.businessName || `${item.firstName} ${item.lastName}`}
            </Text>
            <Text style={styles.cardProfession}>
              {item.profession?.trim()
                ? professionDisplayForStored(item.profession).label
                : '—'}
            </Text>
            <Text style={styles.cardFullAddress}>{formatProfessionalAddress(item)}</Text>
            {item.availableToday === true && (
              <Text style={styles.availBadge}>Διαθέσιμος σήμερα</Text>
            )}
            {distance && <Text style={styles.cardDistance}>📍 {distance}</Text>}
            {serviceLine ? <Text style={styles.cardService}>{serviceLine}</Text> : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const filtersModalContent = (
    <ScrollView
      style={styles.modalScroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator
    >
      <View style={styles.filtersInner}>
        <FormSelect
          label="Επάγγελμα"
          value={filterProfession}
          options={professions}
          onChange={setFilterProfession}
          placeholder="Όλα τα επαγγέλματα"
          allowEmpty
          emptyLabel="Όλα τα επαγγέλματα"
          getOptionLabel={(v) => professionDisplayForStored(v).label}
        />
        <FormSelect
          label="Πόλη"
          value={filterCity}
          options={cityLabels}
          onChange={setFilterCity}
          placeholder="Όλες οι πόλεις"
          allowEmpty
          emptyLabel="Όλες οι πόλεις"
        />
        <FormSelect
          label="Ακτίνα από εμένα"
          value={RADIUS_FILTER_OPTIONS.find((o) => o.key === radiusKey)?.label ?? ''}
          options={RADIUS_FILTER_OPTIONS.map((o) => o.label)}
          onChange={(label) => {
            const o = RADIUS_FILTER_OPTIONS.find((x) => x.label === label);
            if (o) setRadiusKey(o.key);
          }}
          placeholder="Όλες οι αποστάσεις"
        />
        {radiusNeedsLocation && (
          <Text style={styles.warnText}>
            Ενεργοποίησε την τοποθεσία για φίλτρο ακτίνας (Ρυθμίσεις → τοποθεσία). Η απόσταση
            υπολογίζεται από το τρέχον GPS σου και τα lat/lng του επαγγελματία στη βάση.
          </Text>
        )}
        <FormSelect
          label="Ταξινόμηση τιμής"
          value={PRICE_SORT_OPTIONS.find((o) => o.key === priceSort)?.label ?? ''}
          options={PRICE_SORT_OPTIONS.map((o) => o.label)}
          onChange={(label) => {
            const o = PRICE_SORT_OPTIONS.find((x) => x.label === label);
            if (o) setPriceSort(o.key);
          }}
          placeholder="Χωρίς ταξινόμηση τιμής"
        />
        <FormSelect
          label="Βαθμολογία"
          value={MIN_RATING_OPTIONS.find((o) => o.key === minRatingKey)?.label ?? ''}
          options={MIN_RATING_OPTIONS.map((o) => o.label)}
          onChange={(label) => {
            const o = MIN_RATING_OPTIONS.find((x) => x.label === label);
            if (o) setMinRatingKey(o.key);
          }}
          placeholder="Όλες οι βαθμολογίες"
        />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Μόνο διαθέσιμοι σήμερα</Text>
          <Switch
            value={onlyAvailableToday}
            onValueChange={setOnlyAvailableToday}
            trackColor={{ false: '#cbd5e1', true: '#93c5fd' }}
            thumbColor={onlyAvailableToday ? '#2563eb' : '#f4f4f5'}
          />
        </View>
      </View>
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const tenantWallBanner =
    !authLoading && user && !hasTenantDataAccess ? (
      <View style={styles.tenantWallBanner}>
        <Text style={styles.tenantWallTitle}>Χωρίς tenant</Text>
        <Text style={styles.tenantWallText}>
          Ο λογαριασμός σου δεν έχει tenantId στο προφίλ. Δεν εμφανίζονται δεδομένα πελατών. Επικοινώνησε
          με τον διαχειριστή.
        </Text>
      </View>
    ) : null;

  return (
    <View style={styles.container}>
      <FlatList
        data={sortedFiltered}
        keyExtractor={(item) => item.uid}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListHeaderComponent={tenantWallBanner ?? undefined}
        ListEmptyComponent={
          !hasTenantDataAccess && user && !authLoading ? (
            <Text style={styles.empty}>Δεν είναι διαθέσιμα δεδομένα χωρίς tenant.</Text>
          ) : (
            <Text style={styles.empty}>Δεν βρέθηκαν επαγγελματίες</Text>
          )
        }
        keyboardShouldPersistTaps="handled"
      />

      <Modal
        visible={filterModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Φίλτρα</Text>
            <TouchableOpacity onPress={() => setFilterModalVisible(false)} hitSlop={12}>
              <Text style={styles.modalDone}>Έτοιμο</Text>
            </TouchableOpacity>
          </View>
          {filtersModalContent}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerFilterBtn: { marginRight: 16, padding: 4 },
  modalSheet: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  modalDone: { fontSize: 16, fontWeight: '600', color: '#2563eb' },
  modalScroll: { flex: 1 },
  filtersInner: { padding: 16, gap: 14, paddingBottom: 32 },
  warnText: { fontSize: 12, color: '#b45309', marginTop: -8 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  switchLabel: { fontSize: 14, fontWeight: '600', color: '#475569', flex: 1 },
  list: { padding: 12, paddingBottom: 28 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardBoosted: {
    borderColor: '#facc15',
    backgroundColor: '#fffbeb',
  },
  cardRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: { flex: 1 },
  boostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  boostText: { fontSize: 11, fontWeight: '600', color: '#a16207' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  cardProfession: { fontSize: 13, color: '#059669', marginTop: 2 },
  cardFullAddress: { fontSize: 12, color: '#475569', marginTop: 2, lineHeight: 16 },
  availBadge: { fontSize: 11, fontWeight: '600', color: '#059669', marginTop: 2 },
  cardDistance: { fontSize: 17, fontWeight: '700', color: '#0f172a', marginTop: 4 },
  cardService: { fontSize: 12, color: '#475569', marginTop: 4 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 32, fontSize: 16 },
  tenantWallBanner: {
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  tenantWallTitle: { fontSize: 15, fontWeight: '700', color: '#92400e', marginBottom: 6 },
  tenantWallText: { fontSize: 13, color: '#78350f', lineHeight: 18 },
});
