/**
 * Auth Stack Navigator
 * Handles Login, Register, RegisterUser, RegisterProfessional
 */
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import LoginScreen from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';
import RegisterUserScreen from '../screens/Auth/RegisterUserScreen';
import RegisterProfessionalScreen from '../screens/Auth/RegisterProfessionalScreen';

const Stack = createStackNavigator();

export function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="RegisterUser" component={RegisterUserScreen} />
      <Stack.Screen name="RegisterProfessional" component={RegisterProfessionalScreen} />
    </Stack.Navigator>
  );
}
