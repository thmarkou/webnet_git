/**
 * Λογότυπο login / εγγραφή — το ίδιο αρχείο με το εικονίδιο εφαρμογής: `assets/icon.png`.
 * Αντικατέστησέ το με copy-paste (PNG, ιδανικά 1024×1024) και κάνε `git add` + commit ώστε να μη χαθεί.
 */
import React from 'react';
import { Image, type StyleProp, type ImageStyle } from 'react-native';

const logoSource = require('../../assets/icon.png');

type AppLogoProps = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

export function AppLogo({ size = 100, style }: AppLogoProps) {
  return (
    <Image
      source={logoSource}
      style={[{ width: size, height: size, resizeMode: 'contain' as const }, style]}
      accessibilityLabel="Λογότυπο εφαρμογής"
    />
  );
}
