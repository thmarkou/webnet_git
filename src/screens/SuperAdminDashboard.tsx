/**
 * Super Admin: διαχείριση tenants (πελάτες SaaS).
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Switch,
} from 'react-native';
import {
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  query,
  where,
  limit,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db } from '../api';
import type { TenantDoc } from '../api/types';
import {
  buildGlobalsSuperAdminPayload,
  normalizeEmailForCompare,
  parseSuperAdminEmails,
  SYSTEM_CONFIG_COLLECTION,
  GLOBALS_DOC_ID,
} from '../api/systemConfig';

type TenantRow = TenantDoc & { id: string };

const globalsRef = doc(db, SYSTEM_CONFIG_COLLECTION, GLOBALS_DOC_ID);

export default function SuperAdminDashboard() {
  const { isSuperAdmin, user, refreshTenantAccess, refreshUserProfile } = useAuth();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [superEmailsList, setSuperEmailsList] = useState<string[]>([]);
  const [transferEmail, setTransferEmail] = useState('');
  const [removeSelfFromSupers, setRemoveSelfFromSupers] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');

  const [assignEmail, setAssignEmail] = useState('');
  const [assignTenantId, setAssignTenantId] = useState('');

  const refreshSuperEmails = useCallback(async () => {
    try {
      const snap = await getDoc(globalsRef);
      setSuperEmailsList(
        snap.exists()
          ? parseSuperAdminEmails((snap.data() as { superAdminEmails?: unknown }).superAdminEmails)
          : []
      );
    } catch {
      setSuperEmailsList([]);
    }
  }, []);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'tenants'));
      const rows: TenantRow[] = snap.docs
        .map((d) => {
          const x = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            tenantId: String(x.tenantId ?? d.id),
            displayName: String(x.displayName ?? x.name ?? d.id),
            adminEmail: String(x.adminEmail ?? ''),
            adminUid: typeof x.adminUid === 'string' ? x.adminUid : undefined,
            active: x.active !== false,
            createdAt: x.createdAt as TenantDoc['createdAt'],
          };
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'el'));
      setTenants(rows);
    } catch (e) {
      Alert.alert('Σφάλμα', e instanceof Error ? e.message : 'Firestore');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) void loadTenants();
  }, [isSuperAdmin, loadTenants]);

  useEffect(() => {
    if (isSuperAdmin) void refreshSuperEmails();
  }, [isSuperAdmin, refreshSuperEmails]);

  if (!isSuperAdmin) {
    return (
      <View style={styles.centered}>
        <Text style={styles.warn}>Μόνο Super Admin.</Text>
      </View>
    );
  }

  const applySuperOwnershipTransfer = async () => {
    const ne = normalizeEmailForCompare(transferEmail.trim());
    if (!ne) {
      Alert.alert('Συμπλήρωσε email.');
      return;
    }
    let next = [...new Set([...superEmailsList, ne])];
    if (removeSelfFromSupers && user?.email) {
      const me = normalizeEmailForCompare(user.email);
      next = next.filter((e) => e !== me);
    }
    if (next.length === 0) {
      Alert.alert('Ασφάλεια', 'Πρέπει να μείνει τουλάχιστον ένας Super Admin.');
      return;
    }
    setLoading(true);
    try {
      let { superAdminEmails, superAdminUids } = await buildGlobalsSuperAdminPayload(db, next);
      const uidSet = new Set(superAdminUids);
      if (user?.uid && user.email) {
        const me = normalizeEmailForCompare(user.email);
        if (next.includes(me)) uidSet.add(user.uid);
      }
      await updateDoc(globalsRef, {
        superAdminEmails,
        superAdminUids: [...uidSet],
      });
      setTransferEmail('');
      setRemoveSelfFromSupers(false);
      await refreshSuperEmails();
      await refreshTenantAccess();
      Alert.alert(
        'OK',
        'Η λίστα Super Admin ενημερώθηκε. Τα δεδομένα (tenantId, πόλεις, κ.λπ.) ανήκουν στον tenant — δεν αλλάζουν με τη μεταφορά πρόσβασης.'
      );
    } catch (e) {
      Alert.alert('Σφάλμα', e instanceof Error ? e.message : '');
    } finally {
      setLoading(false);
    }
  };

  const replaceAllSuperAdmins = () => {
    const ne = normalizeEmailForCompare(transferEmail.trim());
    if (!ne) {
      Alert.alert('Συμπλήρωσε το νέο email.');
      return;
    }
    Alert.alert(
      'Αντικατάσταση Super Admins',
      `Η λίστα θα γίνει ΜΟΝΟ:\n${ne}\n\nΌλοι οι άλλοι χάνουν Super Admin. Συνέχεια;`,
      [
        { text: 'Άκυρο', style: 'cancel' },
        {
          text: 'Αντικατάσταση',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setLoading(true);
              try {
                let { superAdminEmails, superAdminUids } = await buildGlobalsSuperAdminPayload(db, [ne]);
                const uidSet = new Set(superAdminUids);
                if (user?.uid && user.email) {
                  const me = normalizeEmailForCompare(user.email);
                  if (ne === me) uidSet.add(user.uid);
                }
                await updateDoc(globalsRef, {
                  superAdminEmails,
                  superAdminUids: [...uidSet],
                });
                setTransferEmail('');
                setRemoveSelfFromSupers(false);
                await refreshSuperEmails();
                await refreshTenantAccess();
                await refreshUserProfile();
                Alert.alert('OK', 'Η λίστα Super Admin αντικαταστάθηκε.');
              } catch (e) {
                Alert.alert('Σφάλμα', e instanceof Error ? e.message : '');
              } finally {
                setLoading(false);
              }
            })();
          },
        },
      ]
    );
  };

  const createTenant = async () => {
    const name = displayName.trim();
    const em = normalizeEmailForCompare(adminEmail);
    if (!name || !em) {
      Alert.alert('Συμπλήρωσε όνομα tenant και admin email.');
      return;
    }
    setLoading(true);
    try {
      let adminUid: string | undefined;
      try {
        const uq = query(collection(db, 'users'), where('email', '==', em), limit(2));
        const us = await getDocs(uq);
        if (us.docs.length === 1) adminUid = us.docs[0].id;
      } catch {
        /* tenant χωρίς εγγεγραμμένο adminUid — μόνο adminEmail */
      }
      const ref = doc(collection(db, 'tenants'));
      const tenantId = ref.id;
      const payload: TenantDoc = {
        tenantId,
        displayName: name,
        adminEmail: em,
        ...(adminUid ? { adminUid } : {}),
        active: true,
        createdAt: Timestamp.now(),
      };
      await setDoc(ref, payload);
      setDisplayName('');
      setAdminEmail('');
      await loadTenants();
      await refreshTenantAccess();
      Alert.alert('OK', `Δημιουργήθηκε tenant.\ntenantId: ${tenantId}`);
    } catch (e) {
      Alert.alert('Σφάλμα', e instanceof Error ? e.message : '');
    } finally {
      setLoading(false);
    }
  };

  const assignUserToTenant = async () => {
    const em = normalizeEmailForCompare(assignEmail);
    const tid = assignTenantId.trim();
    if (!em || !tid) {
      Alert.alert('Συμπλήρωσε email χρήστη και tenantId.');
      return;
    }
    if (!tenants.some((t) => t.tenantId === tid)) {
      Alert.alert('Έλεγχος', 'Το tenantId δεν ταιριάζει με κάποιον ενεργό tenant στη λίστα.');
      return;
    }
    setLoading(true);
    try {
      const uq = query(collection(db, 'users'), where('email', '==', em), limit(5));
      const us = await getDocs(uq);
      if (us.empty) {
        Alert.alert('Δεν βρέθηκε', `Δεν υπάρχει χρήστης με email: ${em}`);
        return;
      }
      if (us.docs.length > 1) {
        Alert.alert('Πολλαπλά', 'Βρέθηκαν πάνω από ένα έγγραφα με αυτό το email — ενημέρωσε χειροκίνητα στο Console.');
        return;
      }
      const assignedUid = us.docs[0].id;
      await updateDoc(doc(db, 'users', assignedUid), { tenantId: tid });
      const tenantFirestoreId = tenants.find((t) => t.tenantId === tid)?.id;
      if (tenantFirestoreId) {
        await updateDoc(doc(db, 'tenants', tenantFirestoreId), { adminUid: assignedUid, adminEmail: em });
      }
      setAssignEmail('');
      setAssignTenantId('');
      if (user?.email && em === normalizeEmailForCompare(user.email)) {
        await refreshUserProfile();
        await refreshTenantAccess();
      }
      Alert.alert('OK', 'Το προφίλ χρήστη ενημερώθηκε με tenantId.');
    } catch (e) {
      Alert.alert('Σφάλμα', e instanceof Error ? e.message : '');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.section}>
      <Text style={styles.title}>Super Admin</Text>
      {user?.email ? <Text style={styles.sub}>Συνδεδεμένος: {user.email}</Text> : null}

      {loading ? <ActivityIndicator style={{ marginVertical: 12 }} color="#7c3aed" /> : null}

      <Text style={styles.sectionTitle}>Ρυθμίσεις συστήματος</Text>
      <Text style={styles.hint}>
        Μόνο υπάρχοντες Super Admin μπορούν να προσθέτουν άλλους. Το setup wizard κλειδώνει αφού δημιουργηθεί
        το globals.
      </Text>
      <Text style={styles.label}>Τρέχοντες Super Admin (email)</Text>
      {superEmailsList.length === 0 ? (
        <Text style={styles.hint}>—</Text>
      ) : (
        superEmailsList.map((em) => (
          <Text key={em} style={styles.superEmailRow}>
            • {em}
          </Text>
        ))
      )}
      <Text style={[styles.label, { marginTop: 14 }]}>Μεταφορά / προσθήκη Super Admin</Text>
      <TextInput
        style={styles.input}
        value={transferEmail}
        onChangeText={setTransferEmail}
        placeholder="Νέο email Super Admin"
        placeholderTextColor="#94a3b8"
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Αφαίρεση του τρέχοντος λογαριασμού μου από Super Admins</Text>
        <Switch value={removeSelfFromSupers} onValueChange={setRemoveSelfFromSupers} />
      </View>
      <TouchableOpacity style={styles.primary} onPress={() => void applySuperOwnershipTransfer()}>
        <Text style={styles.primaryText}>Προσθήκη / ενημέρωση λίστας</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.dangerOutline} onPress={replaceAllSuperAdmins}>
        <Text style={styles.dangerOutlineText}>Μόνο αυτό το email (πλήρης αντικατάσταση)</Text>
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Ενεργοί tenants</Text>
      {tenants.length === 0 ? (
        <Text style={styles.hint}>Δεν υπάρχουν εγγραφές στη συλλογή tenants.</Text>
      ) : (
        tenants.map((t) => (
          <View key={t.id} style={styles.card}>
            <Text style={styles.cardTitle}>{t.displayName}</Text>
            <Text style={styles.mono}>tenantId: {t.tenantId}</Text>
            <Text style={styles.cardLine}>Admin email: {t.adminEmail}</Text>
            <Text style={styles.cardLine}>{t.active ? 'Ενεργό' : 'Ανενεργό'}</Text>
          </View>
        ))
      )}

      <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Νέος tenant</Text>
      <Text style={styles.label}>Όνομα (π.χ. Client_Greece)</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Εμφανιζόμενο όνομα"
        placeholderTextColor="#94a3b8"
      />
      <Text style={styles.label}>Admin email (tenant admin)</Text>
      <TextInput
        style={styles.input}
        value={adminEmail}
        onChangeText={setAdminEmail}
        placeholder="email@domain.com"
        placeholderTextColor="#94a3b8"
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TouchableOpacity style={styles.primary} onPress={() => void createTenant()}>
        <Text style={styles.primaryText}>Δημιουργία tenant</Text>
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Ανάθεση tenant σε χρήστη</Text>
      <Text style={styles.hint}>
        Μετά την εγγραφή, όρισε tenantId στο προφίλ του χρήστη (Firestore users). Εισάγεις το ίδιο tenantId όπως στη λίστα πάνω.
      </Text>
      <Text style={styles.label}>Email χρήστη (Firebase Auth)</Text>
      <TextInput
        style={styles.input}
        value={assignEmail}
        onChangeText={setAssignEmail}
        placeholder="user@email.com"
        placeholderTextColor="#94a3b8"
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Text style={styles.label}>tenantId</Text>
      <TextInput
        style={styles.input}
        value={assignTenantId}
        onChangeText={setAssignTenantId}
        placeholder="από τη λίστα tenants"
        placeholderTextColor="#94a3b8"
        autoCapitalize="none"
      />
      <TouchableOpacity style={styles.secondary} onPress={() => void assignUserToTenant()}>
        <Text style={styles.secondaryText}>Αποθήκευση tenantId στον χρήστη</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#faf5ff' },
  section: { padding: 16, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#faf5ff' },
  warn: { fontSize: 16, color: '#b45309', textAlign: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: '#4c1d95' },
  sub: { fontSize: 13, color: '#6b7280', marginTop: 6, marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1f2937', marginBottom: 10 },
  hint: { fontSize: 13, color: '#6b7280', lineHeight: 19, marginBottom: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e9d5ff',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  cardLine: { fontSize: 13, color: '#4b5563', marginTop: 4 },
  mono: { fontSize: 12, color: '#7c3aed', marginTop: 4, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    fontSize: 16,
    color: '#111827',
  },
  primary: {
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondary: {
    backgroundColor: '#ede9fe',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  secondaryText: { color: '#5b21b6', fontWeight: '700', fontSize: 15 },
  superEmailRow: { fontSize: 14, color: '#374151', marginBottom: 4 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  switchLabel: { flex: 1, fontSize: 14, color: '#374151' },
  dangerOutline: {
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  dangerOutlineText: { color: '#dc2626', fontWeight: '700', fontSize: 14 },
});
