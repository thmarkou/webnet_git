/**
 * Firebase Storage helpers - image upload
 * Uses expo-file-system for React Native compatibility with local URIs
 */
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import * as FileSystem from 'expo-file-system';
import { storage } from './firebaseConfig';

export async function uploadProfileImage(
  uid: string,
  uri: string
): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const storageRef = ref(storage, `profiles/${uid}/profile.jpg`);
  await uploadString(storageRef, base64, 'base64');
  return getDownloadURL(storageRef);
}
