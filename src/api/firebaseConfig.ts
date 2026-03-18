/**
 * Firebase configuration for webnet-db
 * Add apiKey, messagingSenderId, appId from Firebase Console → Project Settings → Your apps
 */
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyCzugWJn_eA9sZhXUi9-gfdOu7K_6TLq9I',
  authDomain: 'webnet-db.firebaseapp.com',
  projectId: 'webnet-db-4c78f',
  storageBucket: 'webnet-db-4c78f.appspot.com',
  messagingSenderId: '333939600615',
  appId: '1:333939600615:web:3a4d9ea3dfbac4c9ae0642',
};

// Initialize Firebase only once (avoids duplicate instances in React strict mode)
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
} else {
  app = getApps()[0] as FirebaseApp;
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

export { app, auth, db, storage };
