/**
 * Ραντεβού επαγγελματία — εκκρεμή αιτήματα, επιβεβαίωση / απόρριψη, άνοιγμα συνομιλίας με πελάτη.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { MessageCircle } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import type { Appointment, Professional } from '../../api/types';
import {
  confirmAppointment,
  declineAppointment,
  subscribeProPendingAppointments,
} from '../../api/appointmentRequests';
import { navigateToChat } from '../../utils/navigateToChat';

export default function MyAppointmentsScreen() {
  const navigation = useNavigation();
  const { user, userProfile } = useAuth();
  const [rows, setRows] = useState<(Appointment & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const pro = userProfile?.role === 'pro' ? (userProfile as Professional) : null;

  useEffect(() => {
    if (!user?.uid || !pro) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeProPendingAppointments(user.uid, (list) => {
      setRows(list);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid, pro]);

  const onConfirm = (a: Appointment & { id: string }) => {
    if (!user) return;
    setBusyId(a.id);
    void (async () => {
      try {
        await confirmAppointment(a.id, a.proId, a.userId);
        Alert.alert('OK', 'Το ραντεβού επιβεβαιώθηκε. Ο χρήστης ειδοποιήθηκε.');
      } catch (e) {
        Alert.alert('Σφάλμα', e instanceof Error ? e.message : 'Αποτυχία.');
      } finally {
        setBusyId(null);
      }
    })();
  };

  const onDecline = (a: Appointment & { id: string }) => {
    if (!user) return;
    Alert.alert('Απόρριψη', 'Να απορριφθεί το αίτημα ραντεβού;', [
      { text: 'Άκυρο', style: 'cancel' },
      {
        text: 'Απόρριψη',
        style: 'destructive',
        onPress: () => {
          setBusyId(a.id);
          void (async () => {
            try {
              await declineAppointment(a.id, a.proId, a.userId);
            } catch (e) {
              Alert.alert('Σφάλμα', e instanceof Error ? e.message : 'Αποτυχία.');
            } finally {
              setBusyId(null);
            }
          })();
        },
      },
    ]);
  };

  const openChat = (a: Appointment & { id: string }) => {
    if (!pro) return;
    navigateToChat(navigation as unknown as NavigationProp<ParamListBase>, pro, a.userId);
  };

  if (!pro) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Μόνο για επαγγελματίες.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>Εκκρεμή αιτήματα ραντεβού — επιβεβαίωση ή απόρριψη. Ο χρήστης λαμβάνει ειδοποίηση.</Text>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={rows.length === 0 ? styles.emptyList : styles.listPad}
        ListEmptyComponent={
          <Text style={styles.empty}>Δεν υπάρχουν εκκρεμή αιτήματα.</Text>
        }
        renderItem={({ item }) => {
          const busy = busyId === item.id;
          return (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Χρήστης (UID)</Text>
              <Text style={styles.mono} numberOfLines={1}>
                {item.userId}
              </Text>
              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.btnGreen, busy && styles.btnDisabled]}
                  onPress={() => onConfirm(item)}
                  disabled={busy}
                >
                  <Text style={styles.btnGreenText}>Επιβεβαίωση</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnRed, busy && styles.btnDisabled]}
                  onPress={() => onDecline(item)}
                  disabled={busy}
                >
                  <Text style={styles.btnRedText}>Απόρριψη</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.chatLink} onPress={() => openChat(item)}>
                <MessageCircle size={18} color="#059669" />
                <Text style={styles.chatLinkText}>Συνομιλία με πελάτη</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  muted: { color: '#64748b', fontSize: 15 },
  hint: { fontSize: 13, color: '#64748b', paddingHorizontal: 16, paddingTop: 12, lineHeight: 18 },
  listPad: { padding: 16, paddingBottom: 32 },
  emptyList: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  empty: { textAlign: 'center', color: '#94a3b8', fontSize: 15 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' },
  mono: { fontSize: 12, color: '#0f172a', marginTop: 4, fontFamily: 'monospace' },
  row: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btnGreen: {
    flex: 1,
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnGreenText: { color: '#fff', fontWeight: '700' },
  btnRed: {
    flex: 1,
    backgroundColor: '#fef2f2',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  btnRedText: { color: '#dc2626', fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
  chatLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    justifyContent: 'center',
  },
  chatLinkText: { fontSize: 15, fontWeight: '600', color: '#059669' },
});
