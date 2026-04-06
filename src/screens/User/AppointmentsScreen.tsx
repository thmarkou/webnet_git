/**
 * Ραντεβού χρήστη — λίστα αιτημάτων & κατάσταση, σύνδεση με προφίλ επαγγελματία.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Calendar } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import type { Appointment } from '../../api/types';
import { fetchProfessionalForDisplay } from '../../api/reviews';
import type { Professional } from '../../api/types';
import { subscribeUserAppointments } from '../../api/appointmentRequests';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Εκκρεμεί',
  confirmed: 'Επιβεβαιωμένο',
  declined: 'Απορρίφθηκε',
  past: 'Ολοκληρωμένο',
};

export default function AppointmentsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [rows, setRows] = useState<(Appointment & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeUserAppointments(user.uid, (list) => {
      setRows(list);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 400);
  };

  const openPro = async (proId: string) => {
    setOpening(proId);
    try {
      const pro: Professional | null = await fetchProfessionalForDisplay(proId);
      if (!pro) return;
      (navigation as { navigate: (a: string, b?: Record<string, unknown>) => void }).navigate('Search', {
        screen: 'ProfessionalDetails',
        params: { professional: pro },
      });
    } finally {
      setOpening(null);
    }
  };

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Συνδέσου για να δεις τα ραντεβού σου.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ραντεβού</Text>
      <Text style={styles.subtitle}>
        Νέα αιτήματα στέλνονται από το προφίλ επαγγελματία («Αίτημα ραντεβού»). Θα ειδοποιηθείς όταν
        επιβεβαιωθούν ή απορριφθούν.
      </Text>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
        contentContainerStyle={rows.length === 0 ? styles.emptyList : styles.listPad}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Calendar size={40} color="#cbd5e1" />
            <Text style={styles.emptyText}>Δεν υπάρχουν ακόμη ραντεβού.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.statusBadge}>{STATUS_LABEL[item.status] ?? item.status}</Text>
            </View>
            <Text style={styles.mono} numberOfLines={1}>
              Επαγγελματίας: {item.proId}
            </Text>
            <TouchableOpacity
              style={[styles.linkBtn, opening === item.proId && styles.linkDisabled]}
              onPress={() => void openPro(item.proId)}
              disabled={opening !== null}
            >
              <Text style={styles.linkBtnText}>Προβολή προφίλ επαγγελματία</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingTop: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#f8fafc' },
  muted: { fontSize: 15, color: '#64748b', textAlign: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: '#0f172a', paddingHorizontal: 20 },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 8, lineHeight: 20, paddingHorizontal: 20, marginBottom: 12 },
  listPad: { paddingHorizontal: 16, paddingBottom: 32 },
  emptyList: { flexGrow: 1, padding: 20 },
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 15, color: '#64748b', marginTop: 16, textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 },
  statusBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  mono: { fontSize: 13, color: '#0f172a', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) },
  linkBtn: { marginTop: 12, paddingVertical: 10, alignItems: 'center' },
  linkDisabled: { opacity: 0.5 },
  linkBtnText: { color: '#2563eb', fontWeight: '700', fontSize: 15 },
});
