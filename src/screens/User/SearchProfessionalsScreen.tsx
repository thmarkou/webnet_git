/**
 * Αναζήτηση επαγγελματιών (social-first): φίλοι στο `users/{uid}.friends` (array UIDs).
 * Κριτικές φίλων στη συλλογή `reviews` → ανάδειξη + ετικέτα «Χρησιμοποιήθηκε από φίλο σου · …».
 * Φίλτρα επαγγέλματος/πόλης με IDs καταλόγου Firestore (συμβατότητα με παλιά δεδομένα μόνο με κείμενο).
 * Κατάταξη: 1) βαθμολόγηση από φίλους, 2) μέση βαθμολογία, 3) εγγύτητα (pin ή κέντρο πόλης).
 */
import React, { useState, useEffect, useMemo, useCallback, useLayoutEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  ScrollView,
  Modal,
  TextInput,
  Pressable,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  query,
  where,
  type CollectionReference,
  type DocumentData,
} from 'firebase/firestore';
import MapView, { Marker, Callout } from 'react-native-maps';
import {
  Phone,
  Mail,
  MessageCircle,
  SlidersHorizontal,
  Map as MapIcon,
  LayoutList,
  Heart,
} from 'lucide-react-native';
import { db } from '../../api';
import type { Professional, Review } from '../../api/types';
import { haversineDistance } from '../../utils/haversine';
import { formatSearchCardServiceLine } from '../../utils/servicePricing';
import { minServicePrice } from '../../utils/proSearch';
import type { SearchStackParamList } from '../../navigation/SearchStack';
import { useAuth } from '../../context/AuthContext';
import { FormSelect } from '../../components/FormSelect';
import { useFirestoreCatalog } from '../../hooks/useFirestoreCatalog';
import { finiteCoordsOrUndefined, normalizeUserProfileFromFirestore } from '../../api/userDocument';
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
import {
  professionalCatalogCityLabel,
  resolveCityCoordinates,
  userSearchHomeCityLabel,
  professionalMapCoordinates,
} from '../../utils/cityCatalogCoords';
import { ProfessionalSearchResultCard } from '../../components/ProfessionalSearchResultCard';
import { professionDisplayForStored } from '../../utils/professionDisplay';
import {
  cityOptionValue,
  proMatchesCityFilter,
  proMatchesProfessionFilter,
  type CatalogProfession,
} from '../../utils/catalogSearchIds';

function mapDocToProfessional(id: string, data: Record<string, unknown>): Professional {
  return normalizeUserProfileFromFirestore(id, data) as Professional;
}

function formatBasePriceLine(pro: Professional): string | null {
  const line = formatSearchCardServiceLine(pro);
  if (line) return line;
  const min = minServicePrice(pro);
  if (min !== Number.POSITIVE_INFINITY) return `Βασική τιμή από €${min}`;
  return null;
}

function availabilityLine(pro: Professional): string | null {
  if (pro.availableToday === true) return 'Διαθέσιμος σήμερα';
  if (pro.availableToday === false) return 'Μη διαθέσιμος σήμερα — ρώτα για ραντεβού';
  return null;
}

const MAP_EDGE_PADDING = { top: 100, right: 48, bottom: 120, left: 48 };
const DEFAULT_REGION = {
  latitude: 37.9838,
  longitude: 23.7275,
  latitudeDelta: 0.35,
  longitudeDelta: 0.35,
};

const FIRESTORE_IN_MAX = 10;

function chunkArray<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size) as T[]);
  }
  return out;
}

export default function SearchProfessionalsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<SearchStackParamList>>();
  const {
    user,
    userProfile,
    loading: authLoading,
    hasTenantDataAccess,
    isSuperAdmin,
    tenantId,
    refreshUserProfile,
  } = useAuth();
  const { cities, professionCatalog } = useFirestoreCatalog();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myFriendIds, setMyFriendIds] = useState<string[]>([]);
  const [friendDisplayByUid, setFriendDisplayByUid] = useState<Record<string, string>>({});
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  /** `professions/{id}` ή embedded id (όνομα) — κενό = όλα */
  const [filterProfessionId, setFilterProfessionId] = useState('');
  /** `cities/{id}` ή ετικέτα embedded — κενό = όλες */
  const [filterCityId, setFilterCityId] = useState('');
  const [radiusKey, setRadiusKey] = useState<RadiusFilterKey>('all');
  const [priceSort, setPriceSort] = useState<PriceSortKey>('none');
  const [minRatingKey, setMinRatingKey] = useState<MinRatingKey>('any');
  const [onlyAvailableToday, setOnlyAvailableToday] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [communicatePro, setCommunicatePro] = useState<Professional | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const mapRef = useRef<MapView | null>(null);
  const [mapReady, setMapReady] = useState(false);
  /** Πρώτο focus μετά login / αλλαγή χρήστη → πλήρης φόρτωση· μετά → αθόρυβο refresh όταν επιστρέφεις στην καρτέλα. */
  const professionalsFirstFocusRef = useRef(true);

  useEffect(() => {
    if (viewMode === 'list') setMapReady(false);
  }, [viewMode]);

  useEffect(() => {
    professionalsFirstFocusRef.current = true;
  }, [user?.uid]);

  useEffect(() => {
    const raw = userProfile?.favorites;
    if (Array.isArray(raw)) {
      setFavoriteIds(new Set(raw.filter((x): x is string => typeof x === 'string')));
    } else {
      setFavoriteIds(new Set());
    }
  }, [userProfile]);

  const toggleFavorite = useCallback(
    async (proId: string) => {
      if (!user?.uid) {
        Alert.alert('Σύνδεση', 'Συνδέσου για να αποθηκεύεις αγαπημένους επαγγελματίες.');
        return;
      }
      const ref = doc(db, 'users', user.uid);
      const isFav = favoriteIds.has(proId);
      try {
        await updateDoc(ref, {
          favorites: isFav ? arrayRemove(proId) : arrayUnion(proId),
        });
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (isFav) next.delete(proId);
          else next.add(proId);
          return next;
        });
        await refreshUserProfile();
      } catch (e) {
        Alert.alert('Σφάλμα', e instanceof Error ? e.message : 'Δεν ήταν δυνατή η ενημέρωση αγαπημένων.');
      }
    },
    [user?.uid, favoriteIds, refreshUserProfile]
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerRightRow}>
          <TouchableOpacity
            onPress={() => setViewMode((m) => (m === 'list' ? 'map' : 'list'))}
            style={styles.headerIconBtn}
            accessibilityLabel={viewMode === 'list' ? 'Προβολή χάρτη' : 'Προβολή λίστας'}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {viewMode === 'list' ? (
              <MapIcon size={22} color="#2563eb" />
            ) : (
              <LayoutList size={22} color="#2563eb" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilterModalVisible(true)}
            style={styles.headerIconBtn}
            accessibilityLabel="Φίλτρα αναζήτησης"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <SlidersHorizontal size={22} color="#2563eb" />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, viewMode]);

  const loadReviewsFromFriends = useCallback(async () => {
    if (myFriendIds.length === 0) {
      setReviews([]);
      return;
    }
    try {
      const chunks = chunkArray(myFriendIds, FIRESTORE_IN_MAX);
      const merged: Review[] = [];
      for (const ch of chunks) {
        const snap = await getDocs(query(collection(db, 'reviews'), where('userId', 'in', ch)));
        for (const d of snap.docs) {
          const data = d.data();
          merged.push({
            id: d.id,
            proId: String(data.proId ?? ''),
            userId: String(data.userId ?? ''),
            stars: typeof data.stars === 'number' ? data.stars : 0,
            comment: data.comment ?? '',
            timestamp: data.timestamp,
          });
        }
      }
      setReviews(merged);
    } catch {
      setReviews([]);
    }
  }, [myFriendIds]);

  useEffect(() => {
    void loadReviewsFromFriends();
  }, [loadReviewsFromFriends]);

  useEffect(() => {
    if (myFriendIds.length === 0) {
      setFriendDisplayByUid({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        myFriendIds.map(async (fid) => {
          try {
            const s = await getDoc(doc(db, 'users', fid));
            if (!s.exists()) return [fid, 'Φίλος'] as const;
            const u = s.data() as { firstName?: string; lastName?: string };
            const n = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
            return [fid, n || 'Φίλος'] as const;
          } catch {
            return [fid, 'Φίλος'] as const;
          }
        })
      );
      if (!cancelled) {
        setFriendDisplayByUid(Object.fromEntries(entries));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [myFriendIds]);

  const reloadProfessionals = useCallback(
    async (showFullScreenSpinner: boolean) => {
      if (authLoading) return;
      if (!hasTenantDataAccess) {
        setProfessionals([]);
        setLoading(false);
        return;
      }
      if (showFullScreenSpinner) setLoading(true);
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
        if (showFullScreenSpinner) setLoading(false);
      }
    },
    [authLoading, hasTenantDataAccess, isSuperAdmin, tenantId]
  );

  useFocusEffect(
    useCallback(() => {
      if (authLoading) return;

      const showSpinner = professionalsFirstFocusRef.current;
      if (professionalsFirstFocusRef.current) {
        professionalsFirstFocusRef.current = false;
      }
      void reloadProfessionals(showSpinner);

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
    }, [authLoading, user?.uid, reloadProfessionals])
  );

  const friendRecommendedProIds = useMemo(() => {
    const s = new Set<string>();
    for (const r of reviews) {
      if (myFriendIds.includes(r.userId) && typeof r.stars === 'number' && r.stars >= 1 && r.proId) {
        s.add(r.proId);
      }
    }
    return s;
  }, [reviews, myFriendIds]);

  /** Πρώτος φίλος (UID) που άφησε κριτική ≥1★ για τον επαγγελματία — για ετικέτα ονόματος. */
  const friendReviewerUidByProId = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of reviews) {
      if (!r.proId || !myFriendIds.includes(r.userId)) continue;
      if (typeof r.stars !== 'number' || r.stars < 1) continue;
      if (!m.has(r.proId)) m.set(r.proId, r.userId);
    }
    return m;
  }, [reviews, myFriendIds]);

  const userHomeCityLabel = useMemo(
    () => userSearchHomeCityLabel(userProfile),
    [userProfile]
  );

  const userHomeCoords = useMemo(
    () => resolveCityCoordinates(userHomeCityLabel, cities),
    [userHomeCityLabel, cities]
  );

  const distanceKmCityToCity = useCallback(
    (pro: Professional): number => {
      if (!userHomeCoords) return Number.POSITIVE_INFINITY;
      const proLabel = professionalCatalogCityLabel(pro);
      const proCoords = resolveCityCoordinates(proLabel, cities);
      if (!proCoords) return Number.POSITIVE_INFINITY;
      return haversineDistance(
        userHomeCoords.latitude,
        userHomeCoords.longitude,
        proCoords.latitude,
        proCoords.longitude
      );
    },
    [userHomeCoords, cities]
  );

  /** Κατάταξη απόστασης: προτεραιότητα σε pin επαγγελματία έναντι κέντρου πόλης catalog. */
  const distanceKmForRanking = useCallback(
    (pro: Professional): number => {
      if (!userHomeCoords) return Number.POSITIVE_INFINITY;
      const pin = finiteCoordsOrUndefined(pro.latitude, pro.longitude);
      if (pin) {
        return haversineDistance(
          userHomeCoords.latitude,
          userHomeCoords.longitude,
          pin.latitude,
          pin.longitude
        );
      }
      return distanceKmCityToCity(pro);
    },
    [userHomeCoords, distanceKmCityToCity]
  );

  const filtered = useMemo(() => {
    let result = professionals;

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((pro) => {
        const full = `${pro.firstName} ${pro.lastName}`.toLowerCase();
        const biz = (pro.businessName ?? '').toLowerCase();
        return full.includes(q) || biz.includes(q);
      });
    }

    if (filterProfessionId.trim()) {
      result = result.filter((pro) =>
        proMatchesProfessionFilter(pro, filterProfessionId, professionCatalog)
      );
    }
    if (filterCityId.trim()) {
      result = result.filter((pro) => proMatchesCityFilter(pro, filterCityId, cities));
    }

    const radiusOpt = RADIUS_FILTER_OPTIONS.find((o) => o.key === radiusKey);
    const maxKm = radiusOpt?.km;
    if (maxKm != null) {
      if (userHomeCoords) {
        result = result.filter((pro) => {
          const km = distanceKmForRanking(pro);
          return km <= maxKm;
        });
      }
    }

    const minOpt = MIN_RATING_OPTIONS.find((o) => o.key === minRatingKey);
    if (minOpt && minOpt.min > 0) {
      result = result.filter((pro) => (pro.ratingAvg ?? 0) >= minOpt.min);
    }

    if (onlyAvailableToday) {
      result = result.filter((pro) => pro.availableToday === true);
    }

    return result;
  }, [
    professionals,
    searchQuery,
    filterProfessionId,
    filterCityId,
    radiusKey,
    userHomeCoords,
    minRatingKey,
    onlyAvailableToday,
    distanceKmForRanking,
    professionCatalog,
    cities,
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
      const recA = friendRecommendedProIds.has(a.uid) ? 1 : 0;
      const recB = friendRecommendedProIds.has(b.uid) ? 1 : 0;
      if (recA !== recB) return recB - recA;

      if (priceSort === 'asc') {
        const pc = comparePriceAsc(a, b);
        if (pc !== 0) return pc;
      } else if (priceSort === 'desc') {
        const pc = comparePriceAsc(b, a);
        if (pc !== 0) return pc;
      }

      const ra = a.ratingAvg ?? 0;
      const rb = b.ratingAvg ?? 0;
      if (rb !== ra) return rb - ra;
      const ta = a.totalReviews ?? 0;
      const tb = b.totalReviews ?? 0;
      if (tb !== ta) return tb - ta;

      return distanceKmForRanking(a) - distanceKmForRanking(b);
    });
    return list;
  }, [
    filtered,
    friendRecommendedProIds,
    priceSort,
    distanceKmForRanking,
  ]);

  const mapMarkers = useMemo(() => {
    const out: { pro: Professional; coord: { latitude: number; longitude: number } }[] = [];
    for (const pro of filtered) {
      const coord = professionalMapCoordinates(pro, cities);
      if (coord) out.push({ pro, coord });
    }
    return out;
  }, [filtered, cities]);

  const mapInitialRegion = useMemo(() => {
    if (userHomeCoords) {
      return {
        latitude: userHomeCoords.latitude,
        longitude: userHomeCoords.longitude,
        latitudeDelta: 0.18,
        longitudeDelta: 0.18,
      };
    }
    return DEFAULT_REGION;
  }, [userHomeCoords]);

  useEffect(() => {
    if (viewMode !== 'map' || !mapReady) return;
    const coords: { latitude: number; longitude: number }[] = mapMarkers.map((m) => m.coord);
    if (userHomeCoords) {
      coords.push({
        latitude: userHomeCoords.latitude,
        longitude: userHomeCoords.longitude,
      });
    }
    const t = setTimeout(() => {
      if (!mapRef.current) return;
      if (coords.length === 0) {
        mapRef.current.animateToRegion(mapInitialRegion, 280);
        return;
      }
      if (coords.length === 1) {
        mapRef.current.animateToRegion(
          {
            latitude: coords[0].latitude,
            longitude: coords[0].longitude,
            latitudeDelta: 0.12,
            longitudeDelta: 0.12,
          },
          320
        );
        return;
      }
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: MAP_EDGE_PADDING,
        animated: true,
      });
    }, 280);
    return () => clearTimeout(t);
  }, [viewMode, mapReady, mapMarkers, userHomeCoords, mapInitialRegion]);

  const formatDistanceKm = (pro: Professional): string | null => {
    const km = distanceKmForRanking(pro);
    if (km === Number.POSITIVE_INFINITY) return null;
    if (km < 1) return `${Math.round(km * 1000)} m από την πόλη σου`;
    return `${km.toFixed(1)} km από την πόλη σου`;
  };

  const radiusNeedsUserCity = radiusKey !== 'all' && !userHomeCoords;

  const listHeader = (
    <View style={styles.listHeader}>
      <TextInput
        style={styles.searchInput}
        placeholder="Όνομα ή επωνυμία…"
        placeholderTextColor="#94a3b8"
        value={searchQuery}
        onChangeText={setSearchQuery}
        autoCorrect={false}
        autoCapitalize="none"
        {...(Platform.OS === 'ios' ? { clearButtonMode: 'while-editing' as const } : {})}
      />
      {!userHomeCoords && userProfile && hasTenantDataAccess ? (
        <Text style={styles.hintMuted}>
          Για απόσταση σε km, η πόλη στο προφίλ σου πρέπει να ταιριάζει με μια πόλη του catalog (Firestore).
        </Text>
      ) : null}
    </View>
  );

  const filtersModalContent = (
    <ScrollView
      style={styles.modalScroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator
    >
      <View style={styles.filtersInner}>
        <FormSelect
          label="Επάγγελμα (κατάλογος tenant)"
          value={filterProfessionId}
          options={professionCatalog.map((p: CatalogProfession) => p.id)}
          onChange={setFilterProfessionId}
          placeholder="Όλα τα επαγγέλματα"
          allowEmpty
          emptyLabel="Όλα τα επαγγέλματα"
          getOptionLabel={(id) =>
            professionDisplayForStored(
              professionCatalog.find((p: CatalogProfession) => p.id === id)?.name ?? id
            ).label
          }
        />
        <FormSelect
          label="Πόλη επαγγελματία (κατάλογος tenant)"
          value={filterCityId}
          options={cities.map(cityOptionValue)}
          onChange={setFilterCityId}
          placeholder="Όλες οι πόλεις"
          allowEmpty
          emptyLabel="Όλες οι πόλεις"
          getOptionLabel={(id) => cities.find((c) => cityOptionValue(c) === id)?.label ?? id}
        />
        <FormSelect
          label="Μέγιστη απόσταση (πόλη σου → πόλη του)"
          value={RADIUS_FILTER_OPTIONS.find((o) => o.key === radiusKey)?.label ?? ''}
          options={RADIUS_FILTER_OPTIONS.map((o) => o.label)}
          onChange={(label) => {
            const o = RADIUS_FILTER_OPTIONS.find((x) => x.label === label);
            if (o) setRadiusKey(o.key);
          }}
          placeholder="Όλες οι αποστάσεις"
        />
        {radiusNeedsUserCity && (
          <Text style={styles.warnText}>
            Συμπλήρωσε/διόρθωσε την πόλη στο προφίλ σου ώστε να ταιριάζει με τις πόλεις του tenant. Η απόσταση
            υπολογίζεται με Haversine μεταξύ συντεταγμένων από τη συλλογή cities.
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
          label="Ελάχιστη βαθμολογία"
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
        <Text style={styles.tenantWallTitle}>Χωρίς tenant στο προφίλ</Text>
        <Text style={styles.tenantWallText}>
          Συνήθως συμπληρώνεται αυτόματα στη σύνδεση. Αν εμφανίζεται αυτό το μήνυμα, κάνε αποσύνδεση και ξανά
          σύνδεση· αν συνεχίζει, επικοινώνησε με διαχειριστή (ή τρέξε εφάπαξ{' '}
          <Text style={{ fontWeight: '700' }}>npm run backfill-user-tenants</Text> με service account).
        </Text>
      </View>
    ) : null;

  const emptyMessage =
    !hasTenantDataAccess && user && !authLoading
      ? 'Δεν είναι διαθέσιμα δεδομένα χωρίς tenant.'
      : professionals.length === 0
        ? 'Η λίστα επαγγελματιών είναι ακόμα άδεια. Ο διαχειριστής μπορεί να προσθέσει επαγγελματίες ή να γίνει εισαγωγή από Excel.'
        : 'Κανένας επαγγελματίας δεν ταιριάζει με τα φίλτρα σου. Δοκίμασε άλλη πόλη, επάγγελμα ή χαμηλότερη ελάχιστη βαθμολογία.';

  const renderMapCallout = (pro: Professional) => {
    const name = pro.businessName?.trim() || `${pro.firstName} ${pro.lastName}`.trim();
    const fav = favoriteIds.has(pro.uid);
    return (
      <Callout tooltip={false}>
        <View style={styles.calloutBox}>
          <View style={styles.calloutHeader}>
            <Text style={styles.calloutTitle} numberOfLines={2}>
              {name}
            </Text>
            <TouchableOpacity
              onPress={() => toggleFavorite(pro.uid)}
              hitSlop={8}
              accessibilityLabel={fav ? 'Αφαίρεση αγαπημένου' : 'Αγαπημένο'}
            >
              <Heart size={22} color={fav ? '#ef4444' : '#94a3b8'} fill={fav ? '#ef4444' : 'transparent'} />
            </TouchableOpacity>
          </View>
          <Text style={styles.calloutRating}>
            ★ {(pro.ratingAvg ?? 0).toFixed(1)}
            {pro.totalReviews ? ` (${pro.totalReviews})` : ''}
          </Text>
          <TouchableOpacity
            style={styles.calloutProfileBtn}
            onPress={() => navigation.navigate('ProfessionalDetails', { professional: pro })}
          >
            <Text style={styles.calloutProfileBtnText}>Προβολή προφίλ</Text>
          </TouchableOpacity>
        </View>
      </Callout>
    );
  };

  return (
    <View style={styles.container}>
      {viewMode === 'list' ? (
        <FlatList
          data={sortedFiltered}
          keyExtractor={(item) => item.uid}
          ListHeaderComponent={
            <>
              {tenantWallBanner}
              {listHeader}
            </>
          }
          renderItem={({ item }) => {
            const social = friendRecommendedProIds.has(item.uid);
            const reviewerUid = friendReviewerUidByProId.get(item.uid);
            const friendName = reviewerUid ? friendDisplayByUid[reviewerUid] : undefined;
            const friendLine =
              social && friendName
                ? `Χρησιμοποιήθηκε από φίλο σου · ${friendName}`
                : social
                  ? 'Χρησιμοποιήθηκε από φίλο σου'
                  : null;
            return (
            <ProfessionalSearchResultCard
              professional={item}
              distanceLabel={formatDistanceKm(item)}
              friendRecommended={social}
              friendUsedByLabel={friendLine}
              onPressCard={() => navigation.navigate('ProfessionalDetails', { professional: item })}
              onPressCommunicate={() => setCommunicatePro(item)}
              availabilityLine={availabilityLine(item)}
              basePriceLine={formatBasePriceLine(item)}
              isFavorite={favoriteIds.has(item.uid)}
              onToggleFavorite={() => toggleFavorite(item.uid)}
            />
            );
          }}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <View style={styles.mapWrap}>
          {tenantWallBanner ? <View style={styles.mapBannerPad}>{tenantWallBanner}</View> : null}
          <View style={styles.mapSearchPad}>{listHeader}</View>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={mapInitialRegion}
            onMapReady={() => setMapReady(true)}
            showsUserLocation={false}
          >
            {userHomeCoords ? (
              <Marker
                coordinate={{
                  latitude: userHomeCoords.latitude,
                  longitude: userHomeCoords.longitude,
                }}
                title="Η πόλη σου"
                pinColor="#2563eb"
              />
            ) : null}
            {mapMarkers.map(({ pro, coord }) => (
              <Marker key={pro.uid} coordinate={coord}>
                {renderMapCallout(pro)}
              </Marker>
            ))}
          </MapView>
          {filtered.length === 0 && hasTenantDataAccess ? (
            <View style={styles.mapEmptyOverlay} pointerEvents="none">
              <Text style={styles.mapEmptyText}>{emptyMessage}</Text>
            </View>
          ) : null}
          {mapMarkers.length === 0 && filtered.length > 0 && hasTenantDataAccess ? (
            <View style={styles.mapEmptyOverlay} pointerEvents="none">
              <Text style={styles.mapEmptyText}>
                Οι επαγγελματίες δεν έχουν συντεταγμένες χάρτη ή πόλη στο catalog — δεν εμφανίζονται κουκίδες.
              </Text>
            </View>
          ) : null}
        </View>
      )}

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

      <Modal
        visible={communicatePro != null}
        transparent
        animationType="fade"
        onRequestClose={() => setCommunicatePro(null)}
      >
        <View style={styles.commBackdrop}>
          <Pressable style={styles.commBackdropTap} onPress={() => setCommunicatePro(null)} />
          <View style={styles.commSheet}>
            <Text style={styles.commTitle}>Επικοινωνία</Text>
            {communicatePro ? (
              <>
                <Text style={styles.commSub} numberOfLines={2}>
                  {communicatePro.businessName || `${communicatePro.firstName} ${communicatePro.lastName}`}
                </Text>
                <TouchableOpacity
                  style={styles.commRow}
                  onPress={() => {
                    if (communicatePro.phone) Linking.openURL(`tel:${communicatePro.phone}`);
                    else Alert.alert('Τηλέφωνο', 'Δεν έχει δηλωθεί τηλέφωνο.');
                    setCommunicatePro(null);
                  }}
                >
                  <Phone size={22} color="#2563eb" />
                  <Text style={styles.commRowText}>Τηλέφωνο</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.commRow}
                  onPress={() => {
                    if (communicatePro.email) Linking.openURL(`mailto:${communicatePro.email}`);
                    else Alert.alert('Email', 'Δεν έχει δηλωθεί email.');
                    setCommunicatePro(null);
                  }}
                >
                  <Mail size={22} color="#2563eb" />
                  <Text style={styles.commRowText}>Email</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.commRow}
                  onPress={() => {
                    setCommunicatePro(null);
                    Alert.alert('Chat', 'Η συνομιλία θα είναι διαθέσιμη σύντομα.');
                  }}
                >
                  <MessageCircle size={22} color="#94a3b8" />
                  <Text style={[styles.commRowText, styles.commRowDisabled]}>Chat (σύντομα)</Text>
                </TouchableOpacity>
              </>
            ) : null}
            <TouchableOpacity style={styles.commCancel} onPress={() => setCommunicatePro(null)}>
              <Text style={styles.commCancelText}>Άκυρο</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRightRow: { flexDirection: 'row', alignItems: 'center', marginRight: 8, gap: 4 },
  headerIconBtn: { padding: 6 },
  list: { paddingHorizontal: 12, paddingBottom: 28 },
  listHeader: { marginBottom: 12 },
  searchInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  hintMuted: { fontSize: 12, color: '#64748b', marginTop: 8, lineHeight: 17 },
  mapWrap: { flex: 1 },
  mapBannerPad: { paddingHorizontal: 12, paddingTop: 8 },
  mapSearchPad: { paddingHorizontal: 12, paddingBottom: 8, backgroundColor: '#f8fafc' },
  map: { flex: 1 },
  mapEmptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(248,250,252,0.75)',
  },
  mapEmptyText: {
    textAlign: 'center',
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  calloutBox: {
    width: 220,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  calloutHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  calloutTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' },
  calloutRating: { fontSize: 13, color: '#b45309', marginTop: 6, fontWeight: '600' },
  calloutProfileBtn: {
    marginTop: 10,
    backgroundColor: '#2563eb',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  calloutProfileBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
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
  empty: { textAlign: 'center', color: '#64748b', marginTop: 24, fontSize: 15, lineHeight: 22, paddingHorizontal: 12 },
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
  commBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  commBackdropTap: { flex: 1 },
  commSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 28,
  },
  commTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  commSub: { fontSize: 14, color: '#64748b', marginTop: 6, marginBottom: 16 },
  commRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  commRowText: { fontSize: 16, color: '#0f172a', fontWeight: '600' },
  commRowDisabled: { color: '#94a3b8' },
  commCancel: { marginTop: 16, alignItems: 'center', paddingVertical: 12 },
  commCancelText: { fontSize: 16, color: '#64748b', fontWeight: '600' },
});
