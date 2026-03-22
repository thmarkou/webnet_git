/**
 * Registration screen for simple users
 * Required: Name, Surname, Email, Phone
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { User } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { FormSelect } from '../../components/FormSelect';
import { CITY_LABELS, PROFESSIONS } from '../../constants/data';

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  RegisterUser: undefined;
  RegisterProfessional: undefined;
};

export default function RegisterUserScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { signUpUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    profession: '',
    location: '',
    password: '',
  });

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    const { firstName, lastName, email, phone, password } = form;
    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !password ||
      !form.profession ||
      !form.location
    ) {
      Alert.alert(
        'Σφάλμα',
        'Συμπλήρωσε: Όνομα, Επώνυμο, Email, Τηλέφωνο, Κωδικός, Επάγγελμα (επιλογή), Πόλη (επιλογή).'
      );
      return;
    }

    setLoading(true);
    try {
      await signUpUser({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        profession: form.profession,
        location: form.location,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Σφάλμα εγγραφής';
      Alert.alert('Σφάλμα', message);
    } finally {
      setLoading(false);
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
        <View style={styles.header}>
          <User size={48} color="#2563eb" strokeWidth={2} />
          <Text style={styles.title}>Εγγραφή Χρήστη</Text>
          <Text style={styles.subtitle}>Δημιούργησε λογαριασμό ως χρήστης</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Όνομα *"
            placeholderTextColor="#94a3b8"
            value={form.firstName}
            onChangeText={(v) => updateField('firstName', v)}
            autoCapitalize="words"
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Επώνυμο *"
            placeholderTextColor="#94a3b8"
            value={form.lastName}
            onChangeText={(v) => updateField('lastName', v)}
            autoCapitalize="words"
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Email *"
            placeholderTextColor="#94a3b8"
            value={form.email}
            onChangeText={(v) => updateField('email', v)}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Τηλέφωνο *"
            placeholderTextColor="#94a3b8"
            value={form.phone}
            onChangeText={(v) => updateField('phone', v)}
            keyboardType="phone-pad"
            editable={!loading}
          />
          <FormSelect
            label="Επάγγελμα *"
            value={form.profession}
            options={PROFESSIONS}
            onChange={(v) => updateField('profession', v)}
            placeholder="Επίλεξε επάγγελμα"
            disabled={loading}
          />
          <FormSelect
            label="Πόλη *"
            value={form.location}
            options={CITY_LABELS}
            onChange={(v) => updateField('location', v)}
            placeholder="Επίλεξε πόλη"
            disabled={loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Κωδικός *"
            placeholderTextColor="#94a3b8"
            value={form.password}
            onChangeText={(v) => updateField('password', v)}
            secureTextEntry
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Εγγραφή</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.link}
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Text style={styles.linkText}>← Επιστροφή</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { flexGrow: 1, padding: 24, paddingTop: 48, paddingBottom: 48 },
  header: { alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginTop: 12 },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  form: { gap: 12 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0f172a',
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { alignItems: 'center', marginTop: 16 },
  linkText: { color: '#2563eb', fontSize: 14 },
});
