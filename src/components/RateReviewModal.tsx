/**
 * Modal βαθμολόγησης & σχολίου για επαγγελματία (ρόλος user).
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Star } from 'lucide-react-native';
import type { Professional } from '../api/types';
import { submitReview } from '../api/reviews';

type Props = {
  visible: boolean;
  onClose: () => void;
  professional: Professional;
  reviewerId: string;
  reviewerName: string;
  onSubmitted?: () => void;
};

export function RateReviewModal({
  visible,
  onClose,
  professional,
  reviewerId,
  reviewerName,
  onSubmitted,
}: Props) {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setStars(5);
      setComment('');
    }
  }, [visible, professional.uid]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await submitReview({
        proId: professional.uid,
        reviewerId,
        reviewerName,
        stars,
        comment,
        isImportedProfessional: professional.imported === true,
      });
      onSubmitted?.();
      onClose();
    } catch (e) {
      Alert.alert('Σφάλμα', e instanceof Error ? e.message : 'Δεν ήταν δυνατή η υποβολή.');
    } finally {
      setSubmitting(false);
    }
  };

  const dateLabel = new Date().toLocaleDateString('el-GR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdropPress} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>Βαθμολόγηση & κριτική</Text>
              <Text style={styles.proName} numberOfLines={2}>
                {professional.businessName || `${professional.firstName} ${professional.lastName}`}
              </Text>
              <Text style={styles.dateMuted}>{dateLabel}</Text>

              <Text style={styles.label}>Αστέρια (1–5)</Text>
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity
                    key={n}
                    onPress={() => setStars(n)}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    accessibilityLabel={`${n} αστέρια`}
                  >
                    <Star
                      size={36}
                      color={n <= stars ? '#f59e0b' : '#e2e8f0'}
                      fill={n <= stars ? '#fbbf24' : 'transparent'}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Σχόλιο (γιατί αυτή η βαθμολογία;)</Text>
              <TextInput
                style={styles.input}
                placeholder="Προαιρετικό σχόλιο…"
                placeholderTextColor="#94a3b8"
                value={comment}
                onChangeText={setComment}
                multiline
                maxLength={1200}
                textAlignVertical="top"
              />

              <View style={styles.actions}>
                <TouchableOpacity style={styles.btnGhost} onPress={onClose} disabled={submitting}>
                  <Text style={styles.btnGhostText}>Άκυρο</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnPrimary, submitting && styles.btnDisabled]}
                  onPress={() => void handleSubmit()}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnPrimaryText}>Υποβολή</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.45)' },
  backdropPress: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    maxHeight: '88%',
  },
  title: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  proName: { fontSize: 15, color: '#475569', marginTop: 6, fontWeight: '600' },
  dateMuted: { fontSize: 13, color: '#94a3b8', marginTop: 4, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8 },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#0f172a',
    minHeight: 100,
    marginBottom: 20,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  btnGhost: { paddingVertical: 12, paddingHorizontal: 16 },
  btnGhostText: { fontSize: 16, color: '#64748b', fontWeight: '600' },
  btnPrimary: {
    backgroundColor: '#059669',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnDisabled: { opacity: 0.6 },
});
