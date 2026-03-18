/**
 * Role selection screen - User or Professional registration
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { User, Briefcase } from 'lucide-react-native';

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  RegisterUser: undefined;
  RegisterProfessional: undefined;
};

export default function RegisterScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Εγγραφή</Text>
      <Text style={styles.subtitle}>Επίλεξε τον τύπο λογαριασμού</Text>

      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('RegisterUser')}
        activeOpacity={0.8}
      >
        <User size={40} color="#2563eb" strokeWidth={2} />
        <Text style={styles.cardTitle}>Χρήστης</Text>
        <Text style={styles.cardDesc}>
          Εγγραφή ως απλός χρήστης για να βρεις επαγγελματίες
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, styles.cardPro]}
        onPress={() => navigation.navigate('RegisterProfessional')}
        activeOpacity={0.8}
      >
        <Briefcase size={40} color="#059669" strokeWidth={2} />
        <Text style={styles.cardTitle}>Επαγγελματίας</Text>
        <Text style={styles.cardDesc}>
          Εγγραφή ως επαγγελματίας με ΑΦΜ και επωνυμία επιχείρησης
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backLink}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backLinkText}>← Επιστροφή στη σύνδεση</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 24,
    paddingTop: 48,
  },
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a', textAlign: 'center' },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  cardPro: { borderColor: '#a7f3d0' },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#0f172a', marginTop: 12 },
  cardDesc: { fontSize: 14, color: '#64748b', marginTop: 4 },
  backLink: { alignItems: 'center', marginTop: 24 },
  backLinkText: { color: '#64748b', fontSize: 14 },
});
