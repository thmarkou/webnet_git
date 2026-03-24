/**
 * Search stack - SearchProfessionalsScreen + ProfessionalDetailsScreen
 */
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import SearchProfessionalsScreen from '../screens/User/SearchProfessionalsScreen';
import ProfessionalDetailsScreen from '../screens/User/ProfessionalDetailsScreen';
import type { Professional } from '../api/types';

export type SearchStackParamList = {
  Search: undefined;
  ProfessionalDetails: { professional: Professional };
};

const Stack = createStackNavigator<SearchStackParamList>();

export function SearchStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Search"
        component={SearchProfessionalsScreen}
        options={{ title: 'Αναζήτηση επαγγελματιών' }}
      />
      <Stack.Screen
        name="ProfessionalDetails"
        component={ProfessionalDetailsScreen}
        options={{ title: 'Λεπτομέρειες' }}
      />
    </Stack.Navigator>
  );
}
