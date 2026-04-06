/**
 * Global Statistics / Insights για Super Admin — καρτέλες, MaterialCommunityIcons, Refresh.
 */
import React, { useCallback, useState, type ComponentProps } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchSuperAdminGlobalStats, type SuperAdminGlobalStats } from '../api/superAdminAnalytics';

type MciName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type Props = {
  /** Κλήση μετά από επιτυχή ανανέωση (π.χ. parent loading) */
  onRefreshed?: () => void;
};

export function SuperAdminGlobalStatistics({ onRefreshed }: Props) {
  const { width } = useWindowDimensions();
  const cardMin = Math.min(168, (width - 16 * 2 - 10) / 2);
  const [stats, setStats] = useState<SuperAdminGlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await fetchSuperAdminGlobalStats();
      setStats(s);
      onRefreshed?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Σφάλμα φόρτωσης');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [onRefreshed]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.scroll} accessibilityLabel="Στατιστικά πλατφόρμας">
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Insights — υγεία πλατφόρμας</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => void load()}
          accessibilityRole="button"
          accessibilityLabel="Ανανέωση στατιστικών"
        >
          <MaterialCommunityIcons name="refresh" size={22} color="#5b21b6" />
          <Text style={styles.refreshLabel}>Ανανέωση</Text>
        </TouchableOpacity>
      </View>

      {loading && !stats ? (
        <ActivityIndicator size="large" color="#7c3aed" style={{ marginVertical: 24 }} />
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {stats ? (
        <>
          <Text style={styles.subheading}>Σύνολα</Text>
          <View style={styles.grid}>
            <StatCard
              icon="account-multiple"
              label="Χρήστες (τέλος χρήστη)"
              value={stats.usersEndUser}
              color="#2563eb"
              minWidth={cardMin}
            />
            <StatCard
              icon="briefcase-account"
              label="Επαγγελματίες"
              value={stats.usersProfessional}
              color="#059669"
              minWidth={cardMin}
            />
            <StatCard
              icon="account-supervisor"
              label="Super Admin (ρόλος)"
              value={stats.usersSuperAdmin}
              color="#7c3aed"
              minWidth={cardMin}
            />
            <StatCard
              icon="account-heart"
              label="Συνδέσεις φιλίας (ζεύγη)"
              value={stats.friendConnectionsCount}
              color="#db2777"
              minWidth={cardMin}
            />
            <StatCard
              icon="calendar-check"
              label="Ραντεβού (σύνολο)"
              value={stats.appointmentsTotal}
              color="#d97706"
              minWidth={cardMin}
            />
            <StatCard
              icon="star-outline"
              label="Κριτικές"
              value={stats.reviewsTotal}
              color="#ca8a04"
              minWidth={cardMin}
            />
          </View>

          <Text style={[styles.subheading, styles.mt]}>Ανάπτυξη (7 ημέρες)</Text>
          <View style={styles.grid}>
            <StatCard
              icon="account-plus"
              label="Νέοι χρήστες"
              value={stats.newUsersLast7Days}
              color="#0ea5e9"
              minWidth={cardMin}
              hint="Με πεδίο createdAt στο προφίλ"
            />
            <StatCard
              icon="calendar-plus"
              label="Νέα ραντεβού"
              value={stats.appointmentsLast7Days}
              color="#14b8a6"
              minWidth={cardMin}
            />
          </View>

          <Text style={[styles.subheading, styles.mt]}>Κορυφαία επαγγέλματα</Text>
          <RankedList items={stats.topProfessions} icon="chart-bar" empty="Δεν υπάρχουν ακόμη επαγγελματίες." />

          <Text style={[styles.subheading, styles.mt]}>Κορυφαίες πόλεις (δραστηριότητα)</Text>
          <Text style={styles.hint}>
            Με βάση πόλη / cityId στα προφίλ επαγγελματιών (πλήθος εγγεγραμμένων pros ανά πόλη).
          </Text>
          <RankedList items={stats.topCities} icon="map-marker-radius" empty="Δεν υπάρχουν δεδομένα πόλης." />

          <Text style={[styles.subheading, styles.mt]}>Συνδρομές (placeholder)</Text>
          <View style={styles.grid}>
            <StatCard
              icon="account-tie"
              label="Pro μέλη (σύνολο)"
              value={stats.proMembersTotal}
              color="#4f46e5"
              minWidth={cardMin}
            />
            <StatCard
              icon="crown-outline"
              label="Pro με συνδρομή"
              value={stats.proSubscribedCount}
              color="#b45309"
              minWidth={cardMin}
              hint="accountStatus=subscribed ή subscriptionPlan"
            />
          </View>
        </>
      ) : null}

      {loading && stats ? (
        <ActivityIndicator size="small" color="#7c3aed" style={{ marginTop: 12 }} />
      ) : null}
    </View>
  );
}

function StatCard(props: {
  icon: MciName;
  label: string;
  value: number;
  color: string;
  minWidth: number;
  hint?: string;
}) {
  const { icon, label, value, color, minWidth, hint } = props;
  return (
    <View style={[styles.card, { minWidth, borderLeftColor: color }]}>
      <MaterialCommunityIcons name={icon} size={28} color={color} />
      <Text style={styles.cardValue}>{value.toLocaleString('el-GR')}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
      {hint ? <Text style={styles.cardHint}>{hint}</Text> : null}
    </View>
  );
}

function RankedList(props: {
  items: { label: string; count: number }[];
  icon: MciName;
  empty: string;
}) {
  const { items, icon, empty } = props;
  if (items.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <MaterialCommunityIcons name="information-outline" size={22} color="#94a3b8" />
        <Text style={styles.emptyText}>{empty}</Text>
      </View>
    );
  }
  return (
    <View style={styles.rankedBox}>
      {items.map((row, i) => (
        <View key={`${row.label}-${i}`} style={styles.rankedRow}>
          <View style={styles.rankedLeft}>
            <Text style={styles.rankedIndex}>{i + 1}</Text>
            <MaterialCommunityIcons name={icon} size={18} color="#7c3aed" />
            <Text style={styles.rankedLabel} numberOfLines={2}>
              {row.label}
            </Text>
          </View>
          <Text style={styles.rankedCount}>{row.count}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 24 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#4c1d95', flex: 1 },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ede9fe',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  refreshLabel: { fontSize: 14, fontWeight: '700', color: '#5b21b6' },
  subheading: { fontSize: 15, fontWeight: '700', color: '#1f2937', marginBottom: 10 },
  mt: { marginTop: 20 },
  hint: { fontSize: 12, color: '#64748b', marginBottom: 8, lineHeight: 18 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  card: {
    flexGrow: 1,
    flexBasis: '47%',
    maxWidth: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e9d5ff',
    borderLeftWidth: 4,
    marginBottom: 2,
  },
  cardValue: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginTop: 6 },
  cardLabel: { fontSize: 12, fontWeight: '600', color: '#475569', marginTop: 4, lineHeight: 16 },
  cardHint: { fontSize: 10, color: '#94a3b8', marginTop: 6, lineHeight: 14 },
  errorText: { color: '#b91c1c', marginBottom: 8, fontSize: 14 },
  rankedBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9d5ff',
    overflow: 'hidden',
  },
  rankedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  rankedLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 },
  rankedIndex: { fontSize: 13, fontWeight: '800', color: '#94a3b8', width: 20 },
  rankedLabel: { fontSize: 14, color: '#334155', flex: 1 },
  rankedCount: { fontSize: 15, fontWeight: '800', color: '#7c3aed' },
  emptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyText: { fontSize: 14, color: '#64748b', flex: 1 },
});
