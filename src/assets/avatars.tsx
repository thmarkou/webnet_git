/**
 * Lucide-based placeholder avatars όταν δεν υπάρχει φωτογραφία προφίλ.
 * Πηγή αλήθειας: `profileDisplayType` από Firestore (εγγραφή επαγγελματία).
 */
import React from 'react';
import { User, UserRound, Building2 } from 'lucide-react-native';
import type { Professional, ProfileDisplayType } from '../api/types';

export type ProfessionalAvatarKind = 'man' | 'woman' | 'business';

export function profileDisplayTypeToAvatarKind(
  t: ProfileDisplayType | undefined
): ProfessionalAvatarKind {
  if (t === 'female') return 'woman';
  if (t === 'company') return 'business';
  return 'man';
}

export function getProfessionalAvatarKind(pro: Professional): ProfessionalAvatarKind {
  if (pro.profileDisplayType) {
    return profileDisplayTypeToAvatarKind(pro.profileDisplayType);
  }
  // Παλιά έγγραφα χωρίς πεδίο → ουδέτερο default
  return 'man';
}

type IconProps = { size: number; color: string };

export function ProfessionalAvatarIcon({
  kind,
  size,
  color,
}: IconProps & { kind: ProfessionalAvatarKind }) {
  switch (kind) {
    case 'woman':
      return <UserRound size={size} color={color} />;
    case 'business':
      return <Building2 size={size} color={color} />;
    default:
      return <User size={size} color={color} />;
  }
}
