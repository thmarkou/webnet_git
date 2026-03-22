/**
 * Admin — πληροφορίες (χωρίς seed script· οι επαγγελματίες εγγράφονται από την εφαρμογή)
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';

export default function AdminDashboardScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Admin</Text>
      <Text style={styles.p}>
        Οι επαγγελματίες προστίθενται μέσω <Text style={styles.bold}>Εγγραφή → Επαγγελματίας</Text> στο κινητό.
        Τα δεδομένα αποθηκεύονται στο Firestore (<Text style={styles.code}>users</Text>) με το Firebase Client SDK.
      </Text>
      <Text style={styles.p}>
        Για διαχείριση λογαριασμών και εγγράφων χρησιμοποίησε το Firebase Console (Authentication + Firestore).
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#f8fafc',
    flexGrow: 1,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  p: { fontSize: 15, color: '#475569', lineHeight: 22, marginBottom: 16 },
  bold: { fontWeight: '700', color: '#0f172a' },
  code: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) },
});
