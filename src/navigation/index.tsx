/**
 * Root navigation - switches between Auth and Main stacks based on auth state
 */
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { AuthStack } from './AuthStack';
import { MainNavigator } from './MainNavigator';
import FirstTimeDatabaseSetupScreen from '../screens/FirstTimeDatabaseSetupScreen';

export function RootNavigator() {
  const { user, loading, needsDatabaseSetup } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (user && needsDatabaseSetup) {
    return <FirstTimeDatabaseSetupScreen />;
  }

  return (
    <NavigationContainer>
      {user ? <MainNavigator /> : <AuthStack />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
});
