/**
 * Settings tab - professional settings and sign out
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { LogOut, Shield } from 'lucide-react-native';
import { AppUiBuildRibbon } from '../../components/AppUiBuildRibbon';
import { navigateToAdminDashboard } from '../../utils/navigateToAdminDashboard';
import { navigateToSuperAdminDashboard } from '../../utils/navigateToSuperAdminDashboard';
import { Crown } from 'lucide-react-native';

export default function ProSettingsScreen() {
  const navigation = useNavigation();
  const { signOut, userProfile, canAccessAdminDashboard, isSuperAdmin } = useAuth();
  const showAdmin = canAccessAdminDashboard;

  const handleSignOut = () => {
    Alert.alert('Αποσύνδεση', 'Θέλεις να αποσυνδεθείς;', [
      { text: 'Άκυρο', style: 'cancel' },
      { text: 'Αποσύνδεση', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <View style={styles.container}>
      <AppUiBuildRibbon />
      <Text style={styles.title}>Ρυθμίσεις (επαγγελματίας)</Text>
      {userProfile && (
        <Text style={styles.email}>{userProfile.email}</Text>
      )}
      {isSuperAdmin ? (
        <TouchableOpacity
          style={styles.superAdminButton}
          onPress={() => navigateToSuperAdminDashboard(navigation)}
        >
          <Crown size={20} color="#5b21b6" />
          <Text style={styles.superAdminButtonText}>Super Admin</Text>
        </TouchableOpacity>
      ) : null}
      {showAdmin ? (
        <TouchableOpacity
          style={styles.adminButton}
          onPress={() => navigateToAdminDashboard(navigation)}
        >
          <Shield size={20} color="#1e3a8a" />
          <Text style={styles.adminButtonText}>Admin Dashboard</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.adminHint}>
          Ως επαγγελματίας βλέπεις αυτή την καρτέλα. Admin: Super Admin / Tenant Admin ή legacy email.
        </Text>
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
  adminHint: { fontSize: 12, color: '#94a3b8', marginBottom: 12, lineHeight: 17 },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#dbeafe',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 16,
  },
  adminButtonText: { fontSize: 15, fontWeight: '700', color: '#1e3a8a' },
  superAdminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ede9fe',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 10,
  },
  superAdminButtonText: { fontSize: 15, fontWeight: '700', color: '#5b21b6' },
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
