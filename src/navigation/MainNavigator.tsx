/**
 * Κύρια πλοήγηση: αν ο επαγγελματίας έχει accountStatus === 'deactivated',
 * εμφανίζεται ΜΟΝΟ η SubscriptionScreen.
 */
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { MainTabNavigator } from './MainTabNavigator';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import AdminAddProfessionalScreen from '../screens/AdminAddProfessionalScreen';
import SuperAdminDashboard from '../screens/SuperAdminDashboard';
import AdminManageProfessionalsScreen from '../screens/AdminManageProfessionalsScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';
import PaymentScreen from '../screens/Professional/PaymentScreen';
import { useAuth } from '../context/AuthContext';
import type { Professional } from '../api/types';
import { isProSubscriptionBlocked } from '../utils/subscription';

export type MainNavigatorParamList = {
  MainTabs: undefined;
  AdminDashboard: undefined;
  AdminAddProfessional: { editId?: string; editSource?: 'users' | 'imported' } | undefined;
  AdminManageProfessionals: undefined;
  SuperAdminDashboard: undefined;
  SubscriptionRequired: undefined;
  PaymentRequired: undefined;
};

const Stack = createStackNavigator<MainNavigatorParamList>();

export function MainNavigator() {
  const { userProfile } = useAuth();
  const pro = userProfile?.role === 'pro' ? (userProfile as Professional) : null;

  const isDeactivated = Boolean(pro && pro.accountStatus === 'deactivated');
  const mustPayNotDeactivated =
    Boolean(pro && !isDeactivated && isProSubscriptionBlocked(pro));

  if (isDeactivated) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="SubscriptionRequired" component={SubscriptionScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {mustPayNotDeactivated ? (
        <Stack.Screen name="PaymentRequired" component={PaymentScreen} />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={MainTabNavigator} />
          <Stack.Screen
            name="AdminDashboard"
            component={AdminDashboardScreen}
            options={{
              headerShown: true,
              title: 'Διαχείριση βάσης',
              headerBackTitle: 'Πίσω',
              headerTintColor: '#0f172a',
            }}
          />
          <Stack.Screen
            name="AdminAddProfessional"
            component={AdminAddProfessionalScreen}
            options={{
              headerShown: true,
              title: 'Νέος επαγγελματίας',
              headerBackTitle: 'Πίσω',
              headerTintColor: '#0f172a',
            }}
          />
          <Stack.Screen
            name="SuperAdminDashboard"
            component={SuperAdminDashboard}
            options={{
              headerShown: true,
              title: 'Super Admin',
              headerBackTitle: 'Πίσω',
              headerTintColor: '#0f172a',
            }}
          />
          <Stack.Screen
            name="AdminManageProfessionals"
            component={AdminManageProfessionalsScreen}
            options={{
              headerShown: true,
              title: 'Διαχείριση επαγγελματιών',
              headerBackTitle: 'Πίσω',
              headerTintColor: '#0f172a',
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
