/**
 * Φίλοι & κοινωνικό δίκτυο: αναζήτηση χρηστών, αιτήματα φιλίας, λίστα φίλων.
 * Τα reviews φίλων ενεργοποιούν boost στην αναζήτηση επαγγελματιών μόλις ενημερωθεί το `friends` στο προφίλ (refresh στο Search).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { User as UserIcon } from 'lucide-react-native';
import { db } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { normalizeUserProfileFromFirestore } from '../../api/userDocument';
import type { FriendRequestDoc, User } from '../../api/types';
import { getProfileImageUri } from '../../utils/imageUtils';
import {
  acceptFriendRequest,
  cancelOutgoingFriendRequest,
  declineFriendRequest,
  fetchUserRoleUserDocs,
  hasPendingOutgoing,
  sendFriendRequest,
  subscribeIncomingFriendRequests,
  unfriend,
} from '../../api/friendRequests';

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

function matchesUserSearch(u: User, queryRaw: string): boolean {
  const q = queryRaw.trim().toLowerCase();
  if (q.length < 2) return false;
  const fn = (u.firstName ?? '').toLowerCase();
  const ln = (u.lastName ?? '').toLowerCase();
  const full = `${fn} ${ln}`.trim();
  const phone = digitsOnly(u.phone ?? '');
  const qDigits = digitsOnly(queryRaw);
  if (full.includes(q) || fn.includes(q) || ln.includes(q)) return true;
  if (qDigits.length >= 3 && phone.length >= 3 && phone.includes(qDigits)) return true;
  return false;
}

function Avatar({ user, size = 48 }: { user: Pick<User, 'profileImageBase64' | 'profileImage'>; size?: number }) {
  const uri = getProfileImageUri(user);
  if (uri) {
    return <Image source={{ uri }} style={[styles.avatarImg, { width: size, height: size, borderRadius: size / 2 }]} />;
  }
  return (
    <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
      <UserIcon size={size * 0.45} color="#94a3b8" />
    </View>
  );
}

export default function FriendsScreen() {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const me = user?.uid;
  const myProfile = userProfile?.role === 'user' ? (userProfile as User) : null;

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [incoming, setIncoming] = useState<{ id: string; data: FriendRequestDoc }[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionUid, setActionUid] = useState<string | null>(null);
  const [pendingOutgoing, setPendingOutgoing] = useState<Set<string>>(new Set());

  const unsubRef = useRef<ReturnType<typeof subscribeIncomingFriendRequests> | null>(null);

  const friendIds = useMemo(() => {
    const raw = myProfile?.friends;
    if (!Array.isArray(raw)) return new Set<string>();
    return new Set(raw.filter((x): x is string => typeof x === 'string'));
  }, [myProfile?.friends]);

  const loadUserDirectory = useCallback(async () => {
    const rows = await fetchUserRoleUserDocs(500);
    const users: User[] = [];
    for (const { uid, data } of rows) {
      try {
        users.push(normalizeUserProfileFromFirestore(uid, data) as User);
      } catch {
        /* skip */
      }
    }
    setAllUsers(users);
  }, []);

  const loadFriendProfiles = useCallback(async () => {
    if (!me || friendIds.size === 0) {
      setFriendProfiles({});
      return;
    }
    const entries = await Promise.all(
      [...friendIds].map(async (fid) => {
        try {
          const s = await getDoc(doc(db, 'users', fid));
          if (!s.exists()) return [fid, null] as const;
          return [fid, normalizeUserProfileFromFirestore(fid, s.data() as Record<string, unknown>) as User] as const;
        } catch {
          return [fid, null] as const;
        }
      })
    );
    const next: Record<string, User> = {};
    for (const [fid, u] of entries) {
      if (u) next[fid] = u;
    }
    setFriendProfiles(next);
  }, [me, friendIds]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchQuery), 380);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (!me) return;
    void loadUserDirectory().finally(() => setLoading(false));
  }, [me, loadUserDirectory]);

  useEffect(() => {
    void loadFriendProfiles();
  }, [loadFriendProfiles]);

  useEffect(() => {
    if (!me) {
      setIncoming([]);
      return;
    }
    unsubRef.current?.();
    unsubRef.current = subscribeIncomingFriendRequests(
      me,
      (rows) => setIncoming(rows),
      () => setIncoming([])
    );
    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [me]);

  /** Προαιρετικό: έλεγχος εκκρεμών εξερχόμενων για τα αποτελέσματα αναζήτησης */
  useEffect(() => {
    if (!me || !debouncedQ.trim() || debouncedQ.trim().length < 2) {
      setPendingOutgoing(new Set());
      return;
    }
    let cancelled = false;
    const run = async () => {
      const candidates = allUsers.filter(
        (u) => u.uid !== me && !friendIds.has(u.uid) && matchesUserSearch(u, debouncedQ)
      );
      const next = new Set<string>();
      await Promise.all(
        candidates.slice(0, 24).map(async (u) => {
          const p = await hasPendingOutgoing(me, u.uid);
          if (p) next.add(u.uid);
        })
      );
      if (!cancelled) setPendingOutgoing(next);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [me, allUsers, debouncedQ, friendIds]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadUserDirectory();
      await loadFriendProfiles();
      await refreshUserProfile();
    } finally {
      setRefreshing(false);
    }
  }, [loadUserDirectory, loadFriendProfiles, refreshUserProfile]);

  const searchResults = useMemo(() => {
    if (!me || !myProfile) return [];
    const q = debouncedQ.trim();
    if (q.length < 2) return [];
    return allUsers.filter((u) => {
      if (u.uid === me) return false;
      if (friendIds.has(u.uid)) return false;
      if (u.role !== 'user') return false;
      return matchesUserSearch(u, q);
    });
  }, [allUsers, debouncedQ, friendIds, me, myProfile]);

  const sortedFriends = useMemo(() => {
    const stub = (uid: string): User => ({
      uid,
      email: '',
      role: 'user',
      firstName: 'Φίλος',
      lastName: '',
      phone: '',
      profession: '',
      location: '',
      friends: [],
      pendingRequests: [],
    });
    return [...friendIds]
      .map((id) => friendProfiles[id] ?? stub(id))
      .sort((a, b) => {
        const na = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nb = `${b.firstName} ${b.lastName}`.toLowerCase();
        return na.localeCompare(nb, 'el');
      });
  }, [friendIds, friendProfiles]);

  const handleSendRequest = async (target: User) => {
    if (!me || !myProfile) return;
    setActionUid(target.uid);
    try {
      await sendFriendRequest(me, target.uid, {
        firstName: myProfile.firstName,
        lastName: myProfile.lastName,
        phone: myProfile.phone,
      });
      setPendingOutgoing((prev) => new Set(prev).add(target.uid));
      Alert.alert('Στάλθηκε', 'Η αίτηση φιλίας στάλθηκε.');
    } catch (e) {
      Alert.alert('Σφάλμα', e instanceof Error ? e.message : 'Δεν ήταν δυνατή η αποστολή.');
    } finally {
      setActionUid(null);
    }
  };

  const handleAccept = async (senderUid: string) => {
    if (!me) return;
    setActionUid(senderUid);
    try {
      await acceptFriendRequest(me, senderUid);
      await refreshUserProfile();
      await loadFriendProfiles();
    } catch (e) {
      Alert.alert('Σφάλμα', e instanceof Error ? e.message : 'Αποτυχία αποδοχής.');
    } finally {
      setActionUid(null);
    }
  };

  const handleDecline = async (senderUid: string) => {
    if (!me) return;
    setActionUid(senderUid);
    try {
      await declineFriendRequest(me, senderUid);
    } catch (e) {
      Alert.alert('Σφάλμα', e instanceof Error ? e.message : 'Αποτυχία.');
    } finally {
      setActionUid(null);
    }
  };

  const handleCancelOutgoing = async (targetUid: string) => {
    if (!me) return;
    setActionUid(targetUid);
    try {
      await cancelOutgoingFriendRequest(me, targetUid);
      setPendingOutgoing((prev) => {
        const n = new Set(prev);
        n.delete(targetUid);
        return n;
      });
    } catch (e) {
      Alert.alert('Σφάλμα', e instanceof Error ? e.message : 'Αποτυχία ακύρωσης.');
    } finally {
      setActionUid(null);
    }
  };

  const handleUnfriend = (other: User) => {
    if (!me) return;
    Alert.alert(
      'Αφαίρεση φίλου',
      `Να αφαιρεθεί ο/η ${other.firstName} ${other.lastName} από τους φίλους σου;`,
      [
        { text: 'Άκυρο', style: 'cancel' },
        {
          text: 'Αφαίρεση',
          style: 'destructive',
          onPress: async () => {
            setActionUid(other.uid);
            try {
              await unfriend(me, other.uid);
              await refreshUserProfile();
              setFriendProfiles((prev) => {
                const n = { ...prev };
                delete n[other.uid];
                return n;
              });
            } catch (e) {
              Alert.alert('Σφάλμα', e instanceof Error ? e.message : 'Αποτυχία.');
            } finally {
              setActionUid(null);
            }
          },
        },
      ]
    );
  };

  if (!user || !myProfile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Συνδέσου ως απλός χρήστης για να διαχειριστείς φίλους.</Text>
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
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.screenTitle}>Δίκτυο</Text>
      <Text style={styles.screenSub}>Βρες άλλους χρήστες και χτίσε το δίκτυό σου για προτάσεις στην αναζήτηση.</Text>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Όνομα, επώνυμο ή τηλέφωνο…"
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
          {...(Platform.OS === 'ios' ? { clearButtonMode: 'while-editing' as const } : {})}
        />
      </View>

      {incoming.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Εισερχόμενα αιτήματα</Text>
          {incoming.map(({ id, data }) => {
            const busy = actionUid === id;
            const name = `${data.fromFirstName} ${data.fromLastName}`.trim() || 'Χρήστης';
            return (
              <View key={id} style={styles.requestCard}>
                <View style={styles.requestInfo}>
                  <View style={styles.avatarSm}>
                    <UserIcon size={22} color="#64748b" />
                  </View>
                  <View style={styles.requestTextCol}>
                    <Text style={styles.name}>{name}</Text>
                    {data.fromPhone ? <Text style={styles.phoneMuted}>{data.fromPhone}</Text> : null}
                  </View>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={[styles.btnOutline, busy && styles.btnDisabled]}
                    onPress={() => handleDecline(id)}
                    disabled={busy}
                  >
                    <Text style={styles.btnOutlineText}>Απόρριψη</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnPrimary, busy && styles.btnDisabled]}
                    onPress={() => handleAccept(id)}
                    disabled={busy}
                  >
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Αποδοχή</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Οι φίλοι σου ({sortedFriends.length})</Text>
        {sortedFriends.length === 0 ? (
          <Text style={styles.emptyHint}>Δεν έχεις ακόμη φίλους — χρησιμοποίησε την αναζήτηση παραπάνω.</Text>
        ) : (
          sortedFriends.map((f) => {
            const busy = actionUid === f.uid;
            return (
              <View key={f.uid} style={styles.friendRow}>
                <Avatar user={f} size={52} />
                <View style={styles.friendInfo}>
                  <Text style={styles.name}>
                    {f.firstName} {f.lastName}
                  </Text>
                  {f.phone ? <Text style={styles.phoneMuted}>{f.phone}</Text> : null}
                </View>
                <TouchableOpacity
                  style={[styles.unfriendBtn, busy && styles.btnDisabled]}
                  onPress={() => handleUnfriend(f)}
                  disabled={busy}
                >
                  <Text style={styles.unfriendText}>Αφαίρεση</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>

      {debouncedQ.trim().length >= 2 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Αποτελέσματα αναζήτησης</Text>
          {searchResults.length === 0 ? (
            <Text style={styles.emptyHint}>Δεν βρέθηκε χρήστης — δοκίμασε άλλα γράμματα ή αριθμούς τηλεφώνου.</Text>
          ) : (
            searchResults.map((u) => {
              const busy = actionUid === u.uid;
              const isPending = pendingOutgoing.has(u.uid);
              return (
                <View key={u.uid} style={styles.searchRow}>
                  <Avatar user={u} size={48} />
                  <View style={styles.friendInfo}>
                    <Text style={styles.name}>
                      {u.firstName} {u.lastName}
                    </Text>
                    {u.phone ? <Text style={styles.phoneMuted}>{u.phone}</Text> : null}
                  </View>
                  {isPending ? (
                    <TouchableOpacity
                      style={[styles.btnGhost, busy && styles.btnDisabled]}
                      onPress={() => handleCancelOutgoing(u.uid)}
                      disabled={busy}
                    >
                      <Text style={styles.btnGhostText}>Ακύρωση</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.btnPrimarySm, busy && styles.btnDisabled]}
                      onPress={() => handleSendRequest(u)}
                      disabled={busy}
                    >
                      {busy ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.btnPrimaryText}>Αίτημα φιλίας</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>
      ) : (
        <Text style={styles.searchHint}>Γράψε τουλάχιστον 2 χαρακτήρες για αναζήτηση χρηστών.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#f8fafc' },
  muted: { fontSize: 15, color: '#64748b', textAlign: 'center' },
  screenTitle: { fontSize: 26, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
  screenSub: { fontSize: 14, color: '#64748b', marginTop: 6, lineHeight: 20, marginBottom: 16 },
  searchWrap: { marginBottom: 8 },
  searchInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  searchHint: { fontSize: 13, color: '#94a3b8', marginTop: 8, textAlign: 'center' },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  emptyHint: { fontSize: 14, color: '#94a3b8', lineHeight: 20 },
  requestCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  requestInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  requestTextCol: { marginLeft: 12, flex: 1 },
  requestActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  avatarSm: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  friendInfo: { flex: 1, marginLeft: 12 },
  name: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  phoneMuted: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  avatarImg: { backgroundColor: '#f1f5f9' },
  avatarPlaceholder: {
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  btnPrimarySm: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 118,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnOutline: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnOutlineText: { color: '#475569', fontWeight: '600', fontSize: 14 },
  btnGhost: { paddingHorizontal: 10, paddingVertical: 8 },
  btnGhostText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
  unfriendBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  unfriendText: { color: '#dc2626', fontWeight: '600', fontSize: 14 },
  btnDisabled: { opacity: 0.55 },
});
