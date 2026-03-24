import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Star, MessageCircle, Heart } from 'lucide-react-native';
import type { Professional } from '../api/types';
import { getProfileImageUri } from '../utils/imageUtils';
import {
  getProfessionalAvatarKind,
  ProfessionalAvatarIcon,
} from '../assets/avatars';
import { professionDisplayForStored } from '../utils/professionDisplay';

export type ProfessionalSearchResultCardProps = {
  professional: Professional;
  distanceLabel: string | null;
  friendRecommended: boolean;
  /** Π.χ. «Χρησιμοποιήθηκε από φίλο σου · Μαρία Π.» */
  friendUsedByLabel?: string | null;
  onPressCard: () => void;
  onPressCommunicate: () => void;
  availabilityLine: string | null;
  basePriceLine: string | null;
  isFavorite: boolean;
  onToggleFavorite: () => void;
};

function StarRow({ ratingAvg, totalReviews }: { ratingAvg: number; totalReviews: number }) {
  const filled = Math.min(5, Math.max(0, Math.round(ratingAvg)));
  const countLabel = totalReviews === 1 ? '1 αξιολόγηση' : `${totalReviews} αξιολογήσεις`;
  return (
    <View style={styles.starRow} accessibilityLabel={`Βαθμολογία ${ratingAvg.toFixed(1)} από 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={14}
          color={i <= filled ? '#f59e0b' : '#cbd5e1'}
          fill={i <= filled ? '#fbbf24' : 'transparent'}
        />
      ))}
      <Text style={styles.ratingNum}>
        {(ratingAvg > 0 ? ratingAvg : 0).toFixed(1)}
        {totalReviews > 0 ? ` · ${countLabel}` : ' · χωρίς αξιολογήσεις'}
      </Text>
    </View>
  );
}

export function ProfessionalSearchResultCard({
  professional: pro,
  distanceLabel,
  friendRecommended,
  friendUsedByLabel,
  onPressCard,
  onPressCommunicate,
  availabilityLine,
  basePriceLine,
  isFavorite,
  onToggleFavorite,
}: ProfessionalSearchResultCardProps) {
  const imageUri = getProfileImageUri(pro);
  const avatarKind = getProfessionalAvatarKind(pro);
  const displayName = pro.businessName?.trim() || `${pro.firstName} ${pro.lastName}`.trim();
  const personLine =
    pro.businessName?.trim() && (pro.firstName || pro.lastName)
      ? `${pro.firstName} ${pro.lastName}`.trim()
      : null;
  const professionLabel = pro.profession?.trim()
    ? professionDisplayForStored(pro.profession).label
    : '—';

  return (
    <View style={[styles.card, friendRecommended && styles.cardBoosted]}>
      <View style={styles.cardMainRow}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onPressCard}
          accessibilityRole="button"
          style={styles.cardTouchable}
        >
          <View style={styles.cardRow}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder} accessibilityLabel="Χωρίς φωτογραφία">
                <ProfessionalAvatarIcon kind={avatarKind} size={26} color="#fff" />
              </View>
            )}
            <View style={styles.cardContent}>
              {friendRecommended && (
                <View style={styles.boostBadge} accessibilityLabel="Social recommendation from a friend">
                  <Star size={14} color="#ca8a04" fill="#facc15" />
                  <Text style={styles.boostText}>
                    {friendUsedByLabel?.trim()
                      ? friendUsedByLabel.trim()
                      : 'Προτεινόμενο από φίλο'}
                  </Text>
                </View>
              )}
              <Text style={styles.cardTitle}>{displayName}</Text>
              {personLine ? <Text style={styles.personSub}>{personLine}</Text> : null}
              <Text style={styles.cardProfession}>{professionLabel}</Text>
              {distanceLabel ? (
                <Text style={styles.cardDistance}>📍 {distanceLabel}</Text>
              ) : (
                <Text style={styles.cardDistanceMuted}>
                  Απόσταση: — (πόλη χρήστη ή επαγγελματία εκτός catalog)
                </Text>
              )}
              <StarRow ratingAvg={pro.ratingAvg ?? 0} totalReviews={pro.totalReviews ?? 0} />
              {availabilityLine ? <Text style={styles.availLine}>{availabilityLine}</Text> : null}
              {basePriceLine ? <Text style={styles.priceLine}>{basePriceLine}</Text> : null}
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.heartBtn}
          onPress={onToggleFavorite}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? 'Αφαίρεση από αγαπημένα' : 'Αποθήκευση στα αγαπημένα'}
        >
          <Heart
            size={26}
            color={isFavorite ? '#ef4444' : '#94a3b8'}
            fill={isFavorite ? '#ef4444' : 'transparent'}
          />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={styles.commBtn}
        onPress={onPressCommunicate}
        accessibilityRole="button"
        accessibilityLabel="Επικοινωνία"
      >
        <MessageCircle size={18} color="#fff" />
        <Text style={styles.commBtnText}>Επικοινωνία</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  cardBoosted: {
    borderColor: '#facc15',
    backgroundColor: '#fffbeb',
  },
  cardMainRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cardTouchable: { flex: 1, minWidth: 0 },
  heartBtn: { paddingTop: 10, paddingRight: 10, paddingLeft: 4 },
  cardRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 12, paddingRight: 4 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: { flex: 1, minWidth: 0 },
  boostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  boostText: { fontSize: 11, fontWeight: '700', color: '#a16207' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  personSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  cardProfession: { fontSize: 13, fontWeight: '600', color: '#059669', marginTop: 4 },
  cardDistance: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginTop: 6 },
  cardDistanceMuted: { fontSize: 12, color: '#94a3b8', marginTop: 6, lineHeight: 16 },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 6, flexWrap: 'wrap' },
  ratingNum: { fontSize: 12, color: '#475569', marginLeft: 6 },
  availLine: { fontSize: 12, fontWeight: '600', color: '#059669', marginTop: 6 },
  priceLine: { fontSize: 13, color: '#334155', marginTop: 4, fontWeight: '500' },
  commBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  commBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
