/**
 * Ειδοποιήσεις in-app — φίλτρα Όλα / Μη αναγνωσμένα / Αναγνωσμένα.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Bell } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import {
  markNotificationRead,
  markAllNotificationsRead,
  subscribeUserNotifications,
} from '../../api/notifications';
import type { NotificationDoc } from '../../api/types';

type FilterKey = 'all' | 'unread' | 'read';

function formatWhen(n: NotificationDoc): string {
  const t = n.createdAt;
  if (t == null) return '';
  try {
    if (typeof t === 'object' && 'toDate' in t && typeof (t as { toDate: () => Date }).toDate === 'function') {
      return (t as { toDate: () => Date }).toDate().toLocaleString('el-GR');
    }
    if (typeof t === 'object' && 'seconds' in t && typeof (t as { seconds: number }).seconds === 'number') {
      return new Date((t as { seconds: number }).seconds * 1000).toLocaleString('el-GR');
    }
  } catch {
    /* ignore */
  }
  return '';
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<(NotificationDoc & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');

  useEffect(() => {
    if (!user?.uid) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeUserNotifications(user.uid, (list) => {
      setRows(list);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const filtered = useMemo(() => {
    if (filter === 'unread') return rows.filter((r) => !r.read);
    if (filter === 'read') return rows.filter((r) => r.read);
    return rows;
  }, [rows, filter]);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 400);
  };

  const onPressRow = async (n: NotificationDoc & { id: string }) => {
    if (!user?.uid || n.read) return;
    try {
      await markNotificationRead(user.uid, n.id);
      setRows((prev) => prev.map((r) => (r.id === n.id ? { ...r, read: true } : r)));
    } catch {
      /* ignore */
    }
  };

  const markAllRead = async () => {
    if (!user?.uid) return;
    try {
      await markAllNotificationsRead(user.uid);
      setRows((prev) => prev.map((r) => ({ ...r, read: true })));
    } catch {
      /* ignore */
    }
  };

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Συνδέσου για ειδοποιήσεις.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {(['all', 'unread', 'read'] as const).map((k) => (
          <TouchableOpacity
            key={k}
            style={[styles.filterChip, filter === k && styles.filterChipActive]}
            onPress={() => setFilter(k)}
          >
            <Text style={[styles.filterChipText, filter === k && styles.filterChipTextActive]}>
              {k === 'all' ? 'Όλα' : k === 'unread' ? 'Μη αναγνωσμένα' : 'Αναγνωσμένα'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {rows.some((r) => !r.read) ? (
        <TouchableOpacity style={styles.markAll} onPress={() => void markAllRead()}>
          <Text style={styles.markAllText}>Σημείωση όλων ως αναγνωσμένα</Text>
        </TouchableOpacity>
      ) : null}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Bell size={40} color="#cbd5e1" />
            <Text style={styles.emptyText}>Δεν υπάρχουν ειδοποιήσεις.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, !item.read && styles.cardUnread]}
            onPress={() => void onPressRow(item)}
            activeOpacity={0.85}
          >
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardBody}>{item.body}</Text>
            <Text style={styles.cardMeta}>{formatWhen(item)}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  muted: { fontSize: 15, color: '#64748b' },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
  },
  filterChipActive: { backgroundColor: '#2563eb' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  filterChipTextActive: { color: '#fff' },
  markAll: { paddingHorizontal: 16, paddingBottom: 8 },
  markAllText: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardUnread: { borderLeftWidth: 4, borderLeftColor: '#2563eb' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  cardBody: { fontSize: 14, color: '#475569', marginTop: 6, lineHeight: 20 },
  cardMeta: { fontSize: 12, color: '#94a3b8', marginTop: 8 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { marginTop: 12, fontSize: 15, color: '#94a3b8' },
});
