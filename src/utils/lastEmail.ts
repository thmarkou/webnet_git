/**
 * Saves and loads the last used email for faster login
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@webnet_last_email';

export async function getLastEmail(): Promise<string> {
  try {
    const value = await AsyncStorage.getItem(KEY);
    return value ?? '';
  } catch {
    return '';
  }
}

export async function setLastEmail(email: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, email);
  } catch {
    // ignore
  }
}
