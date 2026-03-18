/**
 * Search screen - list of professionals with filters, profile images, distance
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../api';
import type { Professional } from '../../api/types';
import { Search } from 'lucide-react-native';
import { haversineDistance } from '../../utils/haversine';
import { getProfileImageUri } from '../../utils/imageUtils';
import type { SearchStackParamList } from '../../navigation/SearchStack';
import * as Location from 'expo-location';

export default function SearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<SearchStackParamList>>();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [filtered, setFiltered] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [filterProfession, setFilterProfession] = useState('');
  const [filterCity, setFilterCity] = useState('');

  useEffect(() => {
    const fetchProfessionals = async () => {
      try {
        const q = query(
          collection(db, 'users'),
          where('role', '==', 'pro')
        );
        const snapshot = await getDocs(q);
        const pros = snapshot.docs.map((d) => ({
          uid: d.id,
          ...d.data(),
        })) as Professional[];
        setProfessionals(pros);
        setFiltered(pros);
      } catch (err) {
        setProfessionals([]);
        setFiltered([]);
      } finally {
        setLoading(false);
      }
    };
    fetchProfessionals();
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          const loc = await Location.getCurrentPositionAsync({});
          setUserLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        } catch {
          // ignore
        }
      }
    })();
  }, []);

  useEffect(() => {
    let result = professionals;
    if (filterProfession.trim()) {
      const p = filterProfession.trim().toLowerCase();
      result = result.filter(
        (pro) => pro.profession?.toLowerCase().includes(p)
      );
    }
    if (filterCity.trim()) {
      const c = filterCity.trim().toLowerCase();
      result = result.filter(
        (pro) => pro.city?.toLowerCase().includes(c)
      );
    }
    setFiltered(result);
  }, [filterProfession, filterCity, professionals]);

  const getDistance = (pro: Professional): string | null => {
    if (!userLocation || pro.latitude == null || pro.longitude == null) return null;
    const km = haversineDistance(
      userLocation.latitude,
      userLocation.longitude,
      pro.latitude,
      pro.longitude
    );
    if (km < 1) return `${Math.round(km * 1000)} m away`;
    return `${km.toFixed(1)} km away`;
  };

  const renderItem = ({ item }: { item: Professional }) => {
    const distance = getDistance(item);
    const imageUri = getProfileImageUri(item);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('ProfessionalDetails', { professional: item })}
      >
        <View style={styles.cardRow}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {item.firstName?.[0]}{item.lastName?.[0]}
              </Text>
            </View>
          )}
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>
              {item.businessName || `${item.firstName} ${item.lastName}`}
            </Text>
            <Text style={styles.cardProfession}>{item.profession || '—'}</Text>
            <Text style={styles.cardCity}>{item.city || '—'}</Text>
            {distance && (
              <Text style={styles.cardDistance}>📍 {distance}</Text>
            )}
            {item.services?.length > 0 && (
              <Text style={styles.cardService}>
                {item.services[0].name} — €{item.services[0].price}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <View style={styles.searchRow}>
          <Search size={20} color="#64748b" />
          <TextInput
            style={styles.filterInput}
            placeholder="Επάγγελμα"
            placeholderTextColor="#94a3b8"
            value={filterProfession}
            onChangeText={setFilterProfession}
          />
        </View>
        <View style={styles.searchRow}>
          <Search size={20} color="#64748b" />
          <TextInput
            style={styles.filterInput}
            placeholder="Πόλη"
            placeholderTextColor="#94a3b8"
            value={filterCity}
            onChangeText={setFilterCity}
          />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.uid}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>Δεν βρέθηκαν επαγγελματίες</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filters: {
    padding: 16,
    gap: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  filterInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#0f172a' },
  list: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardRow: { flexDirection: 'row', gap: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#0f172a' },
  cardProfession: { fontSize: 14, color: '#059669', marginTop: 4 },
  cardCity: { fontSize: 14, color: '#64748b', marginTop: 2 },
  cardDistance: { fontSize: 13, color: '#475569', marginTop: 2 },
  cardService: { fontSize: 13, color: '#475569', marginTop: 6 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 32, fontSize: 16 },
});
