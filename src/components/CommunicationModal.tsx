/**
 * Επικοινωνία: κλήση, email, συνομιλία (πλοήγηση στο Chat).
 */
import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { Phone, Mail, MessageCircle } from 'lucide-react-native';
import type { Professional } from '../api/types';

type Props = {
  visible: boolean;
  professional: Professional | null;
  onClose: () => void;
  onOpenChat: (pro: Professional) => void;
  /** Ψευδής για εισαγόμενους επαγγελματίες χωρίς λογαριασμό — το chat απαιτεί σύνδεση επαγγελματία. */
  canUseChat?: boolean;
};

export function CommunicationModal({
  visible,
  professional,
  onClose,
  onOpenChat,
  canUseChat = true,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Επικοινωνία</Text>
          {professional ? (
            <>
              <Text style={styles.sub} numberOfLines={2}>
                {professional.businessName || `${professional.firstName} ${professional.lastName}`}
              </Text>
              <TouchableOpacity
                style={styles.row}
                onPress={() => {
                  if (professional.phone) Linking.openURL(`tel:${professional.phone}`);
                  else Alert.alert('Τηλέφωνο', 'Δεν έχει δηλωθεί τηλέφωνο.');
                  onClose();
                }}
              >
                <Phone size={22} color="#2563eb" />
                <Text style={styles.rowText}>Κλήση</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.row}
                onPress={() => {
                  if (professional.email) Linking.openURL(`mailto:${professional.email}`);
                  else Alert.alert('Email', 'Δεν έχει δηλωθεί email.');
                  onClose();
                }}
              >
                <Mail size={22} color="#2563eb" />
                <Text style={styles.rowText}>Email</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.row}
                onPress={() => {
                  if (!canUseChat) {
                    Alert.alert(
                      'Συνομιλία',
                      'Η συνομιλία in-app είναι διαθέσιμη για επαγγελματίες με λογαριασμό στην εφαρμογή.'
                    );
                    return;
                  }
                  onClose();
                  onOpenChat(professional);
                }}
              >
                <MessageCircle size={22} color={canUseChat ? '#059669' : '#94a3b8'} />
                <Text style={[styles.rowText, !canUseChat && styles.rowDisabled]}>Συνομιλία</Text>
              </TouchableOpacity>
            </>
          ) : null}
          <TouchableOpacity style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Άκυρο</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  backdropTap: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 22,
    paddingBottom: 28,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  sub: { fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 8, marginBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  rowText: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  rowDisabled: { color: '#94a3b8' },
  cancel: { marginTop: 16, paddingVertical: 12, alignItems: 'center' },
  cancelText: { fontSize: 16, color: '#64748b', fontWeight: '600' },
});
