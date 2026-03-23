/**
 * Μοναδική ροή όταν δεν υπάρχει ακόμα το `system_config/globals` στο Firestore.
 * Μετά τη δημιουργία, το wizard κλειδώνει μόνιμα — νέοι Super Admin μόνο από υπάρχοντες.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { LogOut } from 'lucide-react-native';

export default function FirstTimeDatabaseSetupScreen() {
  const { user, completeFirstTimeDatabaseSetup, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onBecomeSuperAdmin = async () => {
    setError(null);
    setBusy(true);
    try {
      await completeFirstTimeDatabaseSetup();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Αποτυχία ρύθμισης');
    } finally {
      setBusy(false);
    }
  };

  const alreadyConfiguredHint =
    error != null && error.includes('ήδη ρυθμιστεί');

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.title}>Καλώς ήρθες</Text>
        {alreadyConfiguredHint ? (
          <Text style={styles.body}>
            Το έγγραφο συστήματος υπάρχει ήδη στο Firestore. Αν μόλις ολοκλήρωσες ρύθμιση, κλείσε την εφαρμογή
            ή κάνε αποσύνδεση και ξανά σύνδεση ώστε να φορτωθεί σωστά η κατάσταση.
          </Text>
        ) : (
          <Text style={styles.body}>
            Αυτή η βάση δεν έχει ρυθμιστεί ακόμα (λείπει το έγγραφο συστήματος). Μπορείς να γίνεις ο πρώτος
            Super Admin, να δημιουργηθεί ο προεπιλεγμένος tenant και να συνδεθεί ο λογαριασμός σου με αυτόν.
          </Text>
        )}
        <Text style={styles.email}>{user?.email ?? ''}</Text>
        <Text style={styles.warn}>
          Χρησιμοποίησε λογαριασμό που εμπιστεύεσαι. Η ενέργεια γίνεται μία φορά ανά project.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.primary, busy && styles.primaryDisabled]}
          onPress={() => void onBecomeSuperAdmin()}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>Γίνομαι πρώτος Super Admin</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.outline} onPress={() => void signOut()} disabled={busy}>
          <LogOut size={18} color="#475569" />
          <Text style={styles.outlineText}>Αποσύνδεση</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0f172a',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
  },
  title: { fontSize: 24, fontWeight: '800', color: '#0f172a', marginBottom: 12 },
  body: { fontSize: 15, color: '#334155', lineHeight: 22, marginBottom: 12 },
  email: { fontSize: 14, fontWeight: '600', color: '#2563eb', marginBottom: 12 },
  warn: { fontSize: 13, color: '#b45309', lineHeight: 19, marginBottom: 16 },
  error: { fontSize: 13, color: '#dc2626', marginBottom: 12 },
  primary: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryDisabled: { opacity: 0.6 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  outline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  outlineText: { fontSize: 15, fontWeight: '600', color: '#475569' },
});
