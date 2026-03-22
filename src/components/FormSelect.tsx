/**
 * Απλό dropdown (Modal + λίστα) — χωρίς επιπλέον native dependency
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { ChevronDown } from 'lucide-react-native';

type FormSelectProps = {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Εμφάνιση επιλογής «Όλα» που περνάει κενό string */
  allowEmpty?: boolean;
  emptyLabel?: string;
};

export function FormSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Επίλεξε…',
  disabled = false,
  allowEmpty = false,
  emptyLabel = 'Όλα',
}: FormSelectProps) {
  const [open, setOpen] = useState(false);

  const listData = allowEmpty ? [emptyLabel, ...options] : [...options];

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.trigger, disabled && styles.triggerDisabled]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={0.7}
        disabled={disabled}
      >
        <Text style={[styles.triggerText, !value && styles.placeholder]}>
          {allowEmpty && value === '' ? emptyLabel : value || placeholder}
        </Text>
        <ChevronDown size={20} color="#64748b" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <FlatList
              data={listData}
              keyExtractor={(item, index) => `${item}-${index}`}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isEmptyChoice = allowEmpty && item === emptyLabel;
                const selected = isEmptyChoice ? value === '' : item === value;
                return (
                  <TouchableOpacity
                    style={[styles.option, selected && styles.optionSelected]}
                    onPress={() => {
                      onChange(isEmptyChoice ? '' : item);
                      setOpen(false);
                    }}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{item}</Text>
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setOpen(false)}>
              <Text style={styles.cancelText}>Άκυρο</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: '#475569' },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  triggerDisabled: { opacity: 0.5 },
  triggerText: { fontSize: 16, color: '#0f172a', flex: 1 },
  placeholder: { color: '#94a3b8' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingBottom: 24,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  option: { paddingVertical: 14, paddingHorizontal: 16 },
  optionSelected: { backgroundColor: '#eff6ff' },
  optionText: { fontSize: 16, color: '#0f172a' },
  optionTextSelected: { fontWeight: '600', color: '#2563eb' },
  cancelBtn: { padding: 16, alignItems: 'center' },
  cancelText: { fontSize: 16, color: '#64748b' },
});
