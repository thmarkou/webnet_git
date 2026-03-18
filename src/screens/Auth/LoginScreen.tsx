/**
 * Login screen - includes Forgot Password and Debug Login (dev only)
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LogIn } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';

/** Test password for debug accounts - ensure these accounts exist in Firebase with this password */
const DEBUG_TEST_PASSWORD = 'Test1234!';

const DEBUG_ACCOUNTS = {
  user: { email: 'theofanis.markou@gmail.com', label: 'Test User' },
  pro: { email: 'fanis.markou@resilienceguard.ch', label: 'Test Pro' },
} as const;

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export default function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { signIn, sendPasswordReset } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Σφάλμα', 'Συμπλήρωσε email και κωδικό.');
      return;
    }

    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Σφάλμα σύνδεσης';
      Alert.alert('Σφάλμα', message);
    } finally {
      setLoading(false);
    }
  };

  const handleDebugLogin = async (type: 'user' | 'pro') => {
    const { email: debugEmail } = DEBUG_ACCOUNTS[type];
    setLoading(true);
    try {
      await signIn(debugEmail, DEBUG_TEST_PASSWORD);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Σφάλμα σύνδεσης';
      Alert.alert(
        'Debug Login Failed',
        `${message}\n\nEnsure the account exists in Firebase with password: ${DEBUG_TEST_PASSWORD}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      Alert.alert('Σφάλμα', 'Εισήγαγε το email σου.');
      return;
    }

    setForgotLoading(true);
    try {
      await sendPasswordReset(forgotEmail.trim());
      Alert.alert('Επιτυχία', 'Στάλθηκε email επαναφοράς κωδικού. Έλεγξε το inbox σου.');
      setForgotModalVisible(false);
      setForgotEmail('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Σφάλμα αποστολής';
      Alert.alert('Σφάλμα', message);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <LogIn size={48} color="#2563eb" strokeWidth={2} />
          <Text style={styles.title}>Σύνδεση</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#94a3b8"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Κωδικός"
            placeholderTextColor="#94a3b8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />

          <TouchableOpacity
            style={styles.forgotLink}
            onPress={() => setForgotModalVisible(true)}
            disabled={loading}
          >
            <Text style={styles.forgotLinkText}>Ξέχασες τον κωδικό;</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Σύνδεση</Text>
            )}
          </TouchableOpacity>

          {__DEV__ && (
            <View style={styles.debugSection}>
              <Text style={styles.debugLabel}>Debug (dev only)</Text>
              <TouchableOpacity
                style={styles.debugButton}
                onPress={() => handleDebugLogin('user')}
                disabled={loading}
              >
                <Text style={styles.debugButtonText}>
                  Login as Test User
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.debugButton, styles.debugButtonPro]}
                onPress={() => handleDebugLogin('pro')}
                disabled={loading}
              >
                <Text style={styles.debugButtonText}>
                  Login as Test Pro
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={styles.link}
            onPress={() => navigation.navigate('Register')}
            disabled={loading}
          >
            <Text style={styles.linkText}>Δεν έχεις λογαριασμό; Εγγραφή</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={forgotModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setForgotModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setForgotModalVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Επαναφορά κωδικού</Text>
            <Text style={styles.modalSubtitle}>
              Εισήγαγε το email σου και θα σου στείλουμε σύνδεσμο για επαναφορά.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Email"
              placeholderTextColor="#94a3b8"
              value={forgotEmail}
              onChangeText={setForgotEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!forgotLoading}
            />
            <TouchableOpacity
              style={[styles.modalButton, forgotLoading && styles.buttonDisabled]}
              onPress={handleForgotPassword}
              disabled={forgotLoading}
            >
              {forgotLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.modalButtonText}>Αποστολή</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setForgotModalVisible(false)}
              disabled={forgotLoading}
            >
              <Text style={styles.modalCancelText}>Άκυρο</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  content: { alignItems: 'stretch' },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginTop: 12, textAlign: 'center' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0f172a',
    marginTop: 12,
  },
  forgotLink: { alignSelf: 'flex-end', marginTop: 8 },
  forgotLinkText: { fontSize: 14, color: '#64748b' },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  debugSection: { marginTop: 24, paddingTop: 24, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  debugLabel: { fontSize: 12, color: '#94a3b8', marginBottom: 8, textAlign: 'center' },
  debugButton: {
    backgroundColor: '#64748b',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  debugButtonPro: { backgroundColor: '#059669' },
  debugButtonText: { color: '#fff', fontSize: 14 },
  link: { alignItems: 'center', marginTop: 20 },
  linkText: { color: '#2563eb', fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 16 },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0f172a',
    marginBottom: 16,
  },
  modalButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalCancel: { alignItems: 'center', marginTop: 16 },
  modalCancelText: { fontSize: 14, color: '#64748b' },
});
