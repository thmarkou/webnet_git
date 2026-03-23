/**
 * Οθόνη πληρωμής/συνδρομής μετά τη λήξη trial ή ληγμένης συνδρομής.
 * Προσωρινή ροή: επιλογή πλάνου → ενημέρωση Firestore (χωρίς πραγματική πληρωμή).
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../api';
import type { SubscriptionPlanId } from '../../api/types';
import { SUBSCRIPTION_PLANS, trialDaysRemaining } from '../../utils/subscription';
import type { Professional } from '../../api/types';

export default function PaymentScreen() {
  const { user, userProfile, refreshUserProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<SubscriptionPlanId>('monthly');
  const pro = userProfile?.role === 'pro' ? (userProfile as Professional) : null;
  const daysLeft = pro ? trialDaysRemaining(pro) : null;

  const activate = async () => {
    if (!user) return;
    const cfg = SUBSCRIPTION_PLANS[plan];
    setLoading(true);
    try {
      const ends = new Date(Date.now() + cfg.durationDays * 24 * 60 * 60 * 1000);
      await updateDoc(doc(db, 'users', user.uid), {
        accountStatus: 'subscribed',
        subscriptionPlan: plan,
        subscriptionEndsAt: Timestamp.fromDate(ends),
      });
      await refreshUserProfile();
      Alert.alert('Ενεργοποίηση', 'Η συνδρομή ενημερώθηκε. Καλώς ήρθες πίσω!', [{ text: 'OK' }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Σφάλμα';
      Alert.alert('Σφάλμα', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Συνδρομή επαγγελματία</Text>
      <Text style={styles.sub}>
        Η δοκιμαστική περίοδος έληξε ή η συνδρομή χρειάζεται ανανέωση. Επίλεξε πλάνο για να συνεχίσεις
        την εμφάνιση στο WebNet.
      </Text>
      {daysLeft != null && daysLeft > 0 ? (
        <Text style={styles.hint}>Απομένουν {daysLeft} ημέρες trial — μπορείς να ανανεώσεις νωρίτερα.</Text>
      ) : null}

      <View style={styles.plans}>
        {(Object.keys(SUBSCRIPTION_PLANS) as SubscriptionPlanId[]).map((key) => {
          const p = SUBSCRIPTION_PLANS[key];
          const selected = plan === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.planCard, selected && styles.planCardSelected]}
              onPress={() => setPlan(key)}
              disabled={loading}
            >
              <Text style={styles.planTitle}>{p.label}</Text>
              <Text style={styles.planPrice}>€{p.priceEuros.toFixed(2)}</Text>
              <Text style={styles.planMeta}>
                {p.durationDays === 30 ? 'ανά μήνα' : 'ανά έτος'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.primary, loading && styles.primaryDisabled]}
        onPress={() => void activate()}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>Ενεργοποίηση (demo — χωρίς πραγματική χρέωση)</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondary} onPress={signOut} disabled={loading}>
        <Text style={styles.secondaryText}>Αποσύνδεση</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 24, paddingTop: 56, backgroundColor: '#f8fafc', flexGrow: 1 },
  title: { fontSize: 26, fontWeight: '800', color: '#0f172a' },
  sub: { fontSize: 15, color: '#64748b', marginTop: 12, lineHeight: 22 },
  hint: { fontSize: 14, color: '#b45309', marginTop: 12, fontWeight: '600' },
  plans: { marginTop: 28, gap: 12 },
  planCard: {
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 18,
    backgroundColor: '#fff',
  },
  planCardSelected: { borderColor: '#059669', backgroundColor: '#ecfdf5' },
  planTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  planPrice: { fontSize: 22, fontWeight: '800', color: '#059669', marginTop: 6 },
  planMeta: { fontSize: 13, color: '#64748b', marginTop: 4 },
  primary: {
    marginTop: 28,
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryDisabled: { opacity: 0.7 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondary: { marginTop: 16, alignItems: 'center', padding: 12 },
  secondaryText: { color: '#64748b', fontSize: 15, fontWeight: '600' },
});
