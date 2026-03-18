/**
 * My Profile tab - professional's profile
 */
import React from 'react';
import { View, Text, ScrollView, StyleSheet, Image } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import type { Professional } from '../../api/types';
import { getProfileImageUri } from '../../utils/imageUtils';

export default function MyProfileScreen() {
  const { userProfile } = useAuth();
  const pro = userProfile as Professional | null;

  if (!pro || pro.role !== 'pro') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Το Προφίλ μου</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {getProfileImageUri(pro) ? (
        <Image source={{ uri: getProfileImageUri(pro)! }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>{pro.firstName?.[0]}{pro.lastName?.[0]}</Text>
        </View>
      )}
      <Text style={styles.title}>{pro.businessName}</Text>
      <Text style={styles.subtitle}>{pro.profession}</Text>
      {pro.bio ? <Text style={styles.bio}>{pro.bio}</Text> : null}
      <View style={styles.section}>
        <Text style={styles.label}>Διεύθυνση</Text>
        <Text style={styles.value}>
          {pro.address} {pro.addressNumber}, {pro.zip} {pro.city}, {pro.country}
        </Text>
      </View>
      {pro.services?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.label}>Υπηρεσίες</Text>
          {pro.services.map((s, i) => (
            <Text key={i} style={styles.service}>
              {s.name} — €{s.price} ({s.duration} λεπτά)
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 24, paddingBottom: 48 },
  avatar: { width: 80, height: 80, borderRadius: 40, alignSelf: 'center', marginBottom: 12 },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#fff' },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 16, color: '#059669', marginTop: 4 },
  bio: { fontSize: 14, color: '#475569', marginTop: 12, lineHeight: 22 },
  section: { marginTop: 24 },
  label: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 4 },
  value: { fontSize: 14, color: '#0f172a' },
  service: { fontSize: 14, color: '#475569', marginTop: 4 },
});
