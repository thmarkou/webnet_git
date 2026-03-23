/**
 * Ρυθμίσεις χρήστη — κουμπί Admin μόνο για συγκεκριμένο email.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { LogOut, Shield, Trash2, UserPlus } from 'lucide-react-native';
import { AppUiBuildRibbon } from '../components/AppUiBuildRibbon';
import { navigateToAdminDashboard } from '../utils/navigateToAdminDashboard';
import { navigateToSuperAdminDashboard } from '../utils/navigateToSuperAdminDashboard';
import { navigateToAdminAddProfessional } from '../utils/navigateToAdminAddProfessional';
import { Crown } from 'lucide-react-native';
import { db } from '../api';
import { resetFirestoreToCrystal } from '../api/resetFirestoreToCrystal';

function AdminButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.adminButton} onPress={onPress}>
      <Shield size={20} color="#1e3a8a" />
      <Text style={styles.adminButtonText}>Admin Dashboard</Text>
    </TouchableOpacity>
  );
}

function SuperAdminButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.superAdminButton} onPress={onPress}>
      <Crown size={20} color="#5b21b6" />
      <Text style={styles.superAdminButtonText}>Super Admin</Text>
    </TouchableOpacity>
  );
}

function AddProfessionalButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.addProButton} onPress={onPress}>
      <UserPlus size={20} color="#14532d" />
      <Text style={styles.addProButtonText}>Προσθήκη επαγγελματία (χωρίς νέο login)</Text>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const navigation = useNavigation();
  const {
    signOut,
    userProfile,
    canAccessAdminDashboard,
    isSuperAdmin,
    refreshTenantAccess,
    refreshUserProfile,
    refreshFirestoreCatalog,
  } = useAuth();
  const showAdmin = canAccessAdminDashboard;
  const [crystalBusy, setCrystalBusy] = useState(false);

  const handleSignOut = () => {
    Alert.alert('Αποσύνδεση', 'Θέλεις να αποσυνδεθείς;', [
      { text: 'Άκυρο', style: 'cancel' },
      { text: 'Αποσύνδεση', style: 'destructive', onPress: signOut },
    ]);
  };

  const confirmCrystalReset = () => {
    Alert.alert(
      'Crystal reset',
      'Θα διαγραφούν: χρήστες, tenants, κριτικές, εισαγόμενοι επαγγελματίες, system_config. Διατηρούνται οι συλλογές πόλεων και επαγγελμάτων. Το Firebase Authentication δεν αλλάζει. Συνέχεια;',
      [
        { text: 'Άκυρο', style: 'cancel' },
        {
          text: 'Διαγραφή όλων',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Τελική επιβεβαίωση',
              'Η ενέργεια δεν αναιρείται. Να εκτελεστεί ο πλήρης καθαρισμός;',
              [
                { text: 'Όχι', style: 'cancel' },
                {
                  text: 'Ναι, crystal',
                  style: 'destructive',
                  onPress: () => void runCrystalReset(),
                },
              ]
            );
          },
        },
      ]
    );
  };

  const runCrystalReset = async () => {
    setCrystalBusy(true);
    try {
      await resetFirestoreToCrystal(db);
      await refreshTenantAccess();
      await refreshUserProfile();
      refreshFirestoreCatalog();
      Alert.alert(
        'Έτοιμο',
        'Έγινε reset για νέο Super Admin / setup. Οι πόλεις και τα επαγγέλματα παρέμειναν. Θα εμφανιστεί ο οδηγός πρώτης ρύθμισης.'
      );
    } catch (e) {
      Alert.alert('Σφάλμα', e instanceof Error ? e.message : 'Αποτυχία καθαρισμού');
    } finally {
      setCrystalBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppUiBuildRibbon />
      <Text style={styles.title}>Ρυθμίσεις</Text>
      {userProfile ? <Text style={styles.email}>{userProfile.email}</Text> : null}

      {isSuperAdmin ? (
        <>
          <SuperAdminButton onPress={() => navigateToSuperAdminDashboard(navigation)} />
          <Text style={styles.dangerZoneTitle}>Κίνδυνος — μόνο ανάπτυξη</Text>
          <Text style={styles.dangerZoneHint}>
            Για αλλαγή Super Admin από την αρχή: σβήνει users, tenants, reviews, importedProfessionals,
            system_config — όχι τις συλλογές cities / professions. Χρειάζονται deployed rules με delete στο
            system_config για Super Admin.
          </Text>
          <TouchableOpacity
            style={[styles.crystalButton, crystalBusy && styles.crystalButtonDisabled]}
            onPress={() => confirmCrystalReset()}
            disabled={crystalBusy}
          >
            {crystalBusy ? (
              <ActivityIndicator color="#991b1b" />
            ) : (
              <Trash2 size={20} color="#991b1b" />
            )}
            <Text style={styles.crystalButtonText}>Crystal — νέο setup (πόλεις & επαγγέλματα μένουν)</Text>
          </TouchableOpacity>
        </>
      ) : null}
      {showAdmin ? (
        <>
          <AdminButton onPress={() => navigateToAdminDashboard(navigation)} />
          <AddProfessionalButton onPress={() => navigateToAdminAddProfessional(navigation)} />
        </>
      ) : (
        <Text style={styles.adminHint}>
          Admin: Super Admin / Tenant Admin (Firestore tenants) ή legacy EXPO_PUBLIC_ADMIN_EMAIL.
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
  addProButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#dcfce7',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 16,
  },
  addProButtonText: { fontSize: 15, fontWeight: '700', color: '#14532d' },
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
  dangerZoneTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#991b1b',
    marginTop: 20,
    marginBottom: 6,
  },
  dangerZoneHint: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 17,
    marginBottom: 10,
  },
  crystalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 16,
  },
  crystalButtonDisabled: { opacity: 0.65 },
  crystalButtonText: { fontSize: 15, fontWeight: '700', color: '#991b1b' },
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
