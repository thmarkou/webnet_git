/**
 * Main Tab Navigator - different tabs for User vs Professional
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Search, Users, Calendar, Settings, User, Bell } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTrialReminders } from '../hooks/useTrialReminders';
import type { Professional } from '../api/types';

import { SearchStack } from './SearchStack';
import FriendsScreen from '../screens/User/FriendsScreen';
import AppointmentsScreen from '../screens/User/AppointmentsScreen';
import NotificationsScreen from '../screens/User/NotificationsScreen';
import SettingsScreen from '../screens/SettingsScreen';

import MyProfileScreen from '../screens/Professional/MyProfileScreen';
import MyAppointmentsScreen from '../screens/Professional/MyAppointmentsScreen';
import ClientsScreen from '../screens/Professional/ClientsScreen';
import ProSettingsScreen from '../screens/Professional/ProSettingsScreen';

const Tab = createBottomTabNavigator();

export function MainTabNavigator() {
  const { userProfile, user } = useAuth();
  const isPro = userProfile?.role === 'pro';
  useTrialReminders(isPro ? (userProfile as Professional) : null, user?.uid);

  if (isPro) {
    return (
      <Tab.Navigator
        screenOptions={{
          headerShown: true,
          tabBarActiveTintColor: '#059669',
          tabBarInactiveTintColor: '#94a3b8',
        }}
      >
        <Tab.Screen
          name="MyProfile"
          component={MyProfileScreen}
          options={{
            title: 'Το Προφίλ μου',
            tabBarLabel: 'Προφίλ',
            tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
          }}
        />
        <Tab.Screen
          name="MyAppointments"
          component={MyAppointmentsScreen}
          options={{
            title: 'Τα Ραντεβού μου',
            tabBarLabel: 'Ραντεβού',
            tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
          }}
        />
        <Tab.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{
            title: 'Ειδοποιήσεις',
            tabBarLabel: 'Ειδοποιήσεις',
            tabBarIcon: ({ color, size }) => <Bell size={size} color={color} />,
          }}
        />
        <Tab.Screen
          name="Clients"
          component={ClientsScreen}
          options={{
            title: 'Πελάτες',
            tabBarLabel: 'Πελάτες',
            tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
          }}
        />
        <Tab.Screen
          name="ProSettings"
          component={ProSettingsScreen}
          options={{
            title: 'Ρυθμίσεις',
            tabBarLabel: 'Ρυθμίσεις',
            tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
          }}
        />
      </Tab.Navigator>
    );
  }

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#94a3b8',
      }}
    >
      <Tab.Screen
        name="Search"
        component={SearchStack}
        options={{
          headerShown: false,
          tabBarLabel: 'Αναζήτηση',
          tabBarIcon: ({ color, size }) => <Search size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Friends"
        component={FriendsScreen}
        options={{
          title: 'Φίλοι',
          tabBarLabel: 'Φίλοι',
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: 'Ειδοποιήσεις',
          tabBarLabel: 'Ειδοποιήσεις',
          tabBarIcon: ({ color, size }) => <Bell size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Appointments"
        component={AppointmentsScreen}
        options={{
          title: 'Ραντεβού',
          tabBarLabel: 'Ραντεβού',
          tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Ρυθμίσεις',
          tabBarLabel: 'Ρυθμίσεις',
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
