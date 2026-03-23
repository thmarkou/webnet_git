import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { APP_UI_BUILD_ID } from '../constants/appUiBuild';

/** Πράσινη ταινία — αν δεν την βλέπεις, δεν φορτώνεις αυτό το project / χρειάζεται cache clear. */
export function AppUiBuildRibbon() {
  return (
    <View style={styles.wrap} accessibilityLabel={`Έκδοση UI ${APP_UI_BUILD_ID}`}>
      <Text style={styles.text}>
        WebNet UI · build {APP_UI_BUILD_ID}
        {Platform.OS === 'ios' ? ' · iOS' : ''}
      </Text>
      <Text style={styles.hint}>
        Αν αυτό δεν αλλάζει μετά από αλλαγές κώδικα: κλείσε την εφαρμογή και τρέξε «npx expo start
        --clear» από τον φάκελο που έχει το package.json με expo.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#15803d',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  text: { color: '#ecfdf5', fontWeight: '800', fontSize: 14 },
  hint: { color: '#bbf7d0', fontSize: 11, marginTop: 6, lineHeight: 15 },
});
