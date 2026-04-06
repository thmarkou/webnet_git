/**
 * Συνομιλία user ↔ επαγγελματίας (realtime).
 * Παράμετροι: `professional` + προαιρετικά `clientUserId` όταν ανοίγει ο επαγγελματίας.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Send } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import type { Professional } from '../../api/types';
import {
  chatIdFor,
  ensureChatDocument,
  sendChatMessage,
  subscribeChatMessages,
  type ChatMessageRow,
} from '../../api/chats';
type ChatRouteParams = { professional: Professional; clientUserId?: string };

export default function ChatScreen() {
  const route = useRoute<RouteProp<{ Chat: ChatRouteParams }, 'Chat'>>();
  const { professional, clientUserId } = route.params;
  const { user, userProfile } = useAuth();
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessageRow>>(null);

  const isProViewer = userProfile?.role === 'pro';

  const { chatId, customerUserId, proUid } = useMemo(() => {
    if (!user) {
      return { chatId: '', customerUserId: '', proUid: professional.uid };
    }
    if (isProViewer && clientUserId) {
      return {
        chatId: chatIdFor(clientUserId, user.uid),
        customerUserId: clientUserId,
        proUid: user.uid,
      };
    }
    return {
      chatId: chatIdFor(user.uid, professional.uid),
      customerUserId: user.uid,
      proUid: professional.uid,
    };
  }, [user, professional.uid, isProViewer, clientUserId]);

  useEffect(() => {
    if (!chatId || !user) return;
    let unsub: (() => void) | undefined;
    void (async () => {
      await ensureChatDocument(customerUserId, proUid);
      unsub = subscribeChatMessages(chatId, setMessages);
    })();
    return () => {
      unsub?.();
    };
  }, [chatId, user, customerUserId, proUid]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const onSend = useCallback(async () => {
    if (!user || !chatId) return;
    const trimmed = input.trim();
    if (!trimmed) return;
    const recipientId = user.uid === customerUserId ? proUid : customerUserId;
    const preview = `Μήνυμα: ${trimmed}`;
    setSending(true);
    try {
      await sendChatMessage(chatId, user.uid, trimmed, recipientId, preview);
      setInput('');
    } finally {
      setSending(false);
    }
  }, [user, chatId, input, customerUserId, proUid]);

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Συνδέσου για συνομιλία.</Text>
      </View>
    );
  }

  if (isProViewer && !clientUserId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Λείπει το αναγνωριστικό πελάτη για τη συνομιλία.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const mine = item.senderId === user.uid;
          return (
            <View style={[styles.bubbleWrap, mine ? styles.bubbleMine : styles.bubbleOther]}>
              <View style={[styles.bubble, mine ? styles.bubbleBgMine : styles.bubbleBgOther]}>
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.text}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>Ξεκίνα τη συνομιλία — γράψε ένα μήνυμα.</Text>
        }
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Γράψε μήνυμα…"
          placeholderTextColor="#94a3b8"
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, sending && styles.sendDisabled]}
          onPress={() => void onSend()}
          disabled={sending || !input.trim()}
        >
          {sending ? <ActivityIndicator color="#fff" size="small" /> : <Send size={22} color="#fff" />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  muted: { fontSize: 15, color: '#64748b', textAlign: 'center' },
  listContent: { padding: 12, paddingBottom: 8 },
  bubbleWrap: { marginBottom: 8, maxWidth: '88%' },
  bubbleMine: { alignSelf: 'flex-end' },
  bubbleOther: { alignSelf: 'flex-start' },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  bubbleBgMine: { backgroundColor: '#2563eb' },
  bubbleBgOther: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  bubbleText: { fontSize: 16, color: '#0f172a' },
  bubbleTextMine: { color: '#fff' },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 32, fontSize: 14 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 120,
    color: '#0f172a',
  },
  sendBtn: {
    backgroundColor: '#059669',
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.5 },
});
