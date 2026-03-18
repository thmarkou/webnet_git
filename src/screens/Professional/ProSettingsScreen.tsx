/**
 * Settings tab - professional settings and sign out
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { LogOut } from 'lucide-react-native';

export default function ProSettingsScreen() {
  const { signOut, userProfile } = useAuth();

  const handleSignOut = () => {
    Alert.alert('Αποσύνδεση', 'Θέλεις να αποσυνδεθείς;', [
      { text: 'Άκυρο', style: 'cancel' },
      { text: 'Αποσύνδεση', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ρυθμίσεις</Text>
      {userProfile && (
        <Text style={styles.email}>{userProfile.email}</Text>
      )}
      <TouchableOpacity style={styles.button} onPress={handleSignOut}>
        <LogOut size={20} color="#fff" />
        <Text style={styles.buttonText}>Αποσύνδεση</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 24 },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  email: { fontSize: 14, color: '#64748b', marginBottom: 24 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingVertical: 14,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
