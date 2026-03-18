/**
 * Clients tab - professional's clients
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ClientsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Πελάτες</Text>
      <Text style={styles.subtitle}>Οι πελάτες σου εμφανίζονται εδώ</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 24, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 8 },
});
