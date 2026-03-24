/**
 * Super Admin: λίστα επαγγελματιών (users + imported), επεξεργασία, διαγραφή με αρχειοθέτηση.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Pressable,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore';
import { Pencil, Trash2 } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { db } from '../api';
import { normalizeEmailForCompare } from '../api/systemConfig';
import type { MainNavigatorParamList } from '../navigation/MainNavigator';
import { withTenantScope } from '../utils/tenantFirestore';

type Source = 'users' | 'imported';

type ProRow = {
  id: string;
  source: Source;
  title: string;
  subtitle: string;
  tenantId: string;
};

export default function AdminManageProfessionalsScreen() {
  const navigation = useNavigation<StackNavigationProp<MainNavigatorParamList>>();
  const { isSuperAdmin, user } = useAuth();
  const [rows, setRows] = useState<ProRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [deleteTarget, setDeleteTarget] = useState<ProRow | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  const loadList = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    try {
      const uq = query(collection(db, 'users'), where('role', '==', 'pro'));
      const impRef = collection(db, 'importedProfessionals');
      const iq = withTenantScope(impRef, null, true);
      const [uSnap, iSnap] = await Promise.all([getDocs(uq), getDocs(iq)]);
      const out: ProRow[] = [];

      uSnap.docs.forEach((d) => {
        const x = d.data() as Record<string, unknown>;
        const business = String(x.businessName ?? '').trim();
        const fn = String(x.firstName ?? '');
        const ln = String(x.lastName ?? '');
        const title = business || `${fn} ${ln}`.trim() || d.id;
        const city = String(x.city ?? '');
        const tid = String(x.tenantId ?? '—');
        out.push({
          id: d.id,
          source: 'users',
          title,
          subtitle: [city, tid].filter(Boolean).join(' · '),
          tenantId: tid,
        });
      });

      iSnap.docs.forEach((d) => {
        const x = d.data() as Record<string, unknown>;
        const business = String(x.businessName ?? x.name ?? '').trim();
        const title = business || d.id;
        const city = String(x.city ?? '');
        const tid = String(x.tenantId ?? '—');
        out.push({
          id: d.id,
          source: 'imported',
          title: `${title} (εισαγωγή)`,
          subtitle: [city, tid].filter(Boolean).join(' · '),
          tenantId: tid,
        });
      });

      out.sort((a, b) => a.title.localeCompare(b.title, 'el'));
      setRows(out);
    } catch (e) {
      Alert.alert('Σφάλμα', e instanceof Error ? e.message : 'Firestore');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  useFocusEffect(
    useCallback(() => {
      void loadList();
    }, [loadList])
  );

  const runDelete = async () => {
    if (!deleteTarget || !user?.email) return;
    const reason = deleteReason.trim();
    if (!reason) {
      Alert.alert('Λόγος', 'Συμπλήρωσε τον λόγο διαγραφής.');
      return;
    }
    const coll = deleteTarget.source === 'imported' ? 'importedProfessionals' : 'users';
    const ref = doc(db, coll, deleteTarget.id);
    setDeleteBusy(true);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        Alert.alert('Σφάλμα', 'Το έγγραφο δεν υπάρχει πλέον.');
        setDeleteTarget(null);
        setDeleteReason('');
        await loadList();
        return;
      }
      const payload = snap.data() as DocumentData;
      await addDoc(collection(db, 'deleted_professionals'), {
        ...payload,
        originalCollection: coll,
        originalId: deleteTarget.id,
        deletionReason: reason,
        deletedAt: Timestamp.now(),
        deletedBy: normalizeEmailForCompare(user.email),
        deletedByUid: user.uid,
      });
      await deleteDoc(ref);
      setDeleteTarget(null);
      setDeleteReason('');
      await loadList();
      Alert.alert('Επιτυχία', 'Ο επαγγελματίας αρχειοθετήθηκε και διαγράφηκε από την ενεργή λίστα.');
    } catch (e) {
      Alert.alert('Αποτυχία', e instanceof Error ? e.message : 'Διαγραφή');
    } finally {
      setDeleteBusy(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <View style={styles.centered}>
        <Text style={styles.warn}>Μόνο Super Admin.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color="#7c3aed" />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => `${item.source}-${item.id}`}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Δεν βρέθηκαν επαγγελματίες.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSub}>{item.subtitle}</Text>
                <Text style={styles.badge}>
                  {item.source === 'users' ? 'Χρήστης (users)' : 'Εισαγωγή (imported)'}
                </Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() =>
                    navigation.navigate('AdminAddProfessional', {
                      editId: item.id,
                      editSource: item.source,
                    })
                  }
                  accessibilityLabel="Επεξεργασία"
                >
                  <Pencil size={22} color="#2563eb" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => {
                    setDeleteReason('');
                    setDeleteTarget(item);
                  }}
                  accessibilityLabel="Διαγραφή"
                >
                  <Trash2 size={22} color="#dc2626" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={deleteTarget != null} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => !deleteBusy && setDeleteTarget(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Είσαι σίγουρος;</Text>
            <Text style={styles.modalBody}>
              Θέλεις να διαγράψεις αυτόν τον επαγγελματία; Τα δεδομένα θα μεταφερθούν στο αρχείο διαγραφών πριν
              σβηστούν από την ενεργή συλλογή.
            </Text>
            <Text style={styles.label}>Λόγος διαγραφής *</Text>
            <TextInput
              style={styles.reasonInput}
              value={deleteReason}
              onChangeText={setDeleteReason}
              placeholder="Περιγράψτε τον λόγο…"
              placeholderTextColor="#94a3b8"
              multiline
              editable={!deleteBusy}
            />
            <View style={styles.modalRow}>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => !deleteBusy && setDeleteTarget(null)}
                disabled={deleteBusy}
              >
                <Text style={styles.btnCancelText}>Άκυρο</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnDanger}
                onPress={() => void runDelete()}
                disabled={deleteBusy}
              >
                {deleteBusy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnDangerText}>Διαγραφή</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#faf5ff' },
  centered: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#faf5ff' },
  warn: { fontSize: 16, color: '#b45309', textAlign: 'center' },
  list: { padding: 16, paddingBottom: 32 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 32, fontSize: 15 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e9d5ff',
  },
  cardText: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  cardSub: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  badge: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    color: '#7c3aed',
  },
  actions: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 10 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  modalBody: { fontSize: 14, color: '#475569', marginTop: 10, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginTop: 14, marginBottom: 6 },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    minHeight: 88,
    textAlignVertical: 'top',
    fontSize: 15,
    color: '#0f172a',
  },
  modalRow: { flexDirection: 'row', gap: 12, marginTop: 18, justifyContent: 'flex-end' },
  btnCancel: {
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  btnCancelText: { color: '#64748b', fontWeight: '700', fontSize: 16 },
  btnDanger: {
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    minWidth: 120,
    alignItems: 'center',
  },
  btnDangerText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
