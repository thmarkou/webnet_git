/**
 * AuthContext - manages authentication state across the app
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../api';
import type { User, Professional, Service } from '../api/types';

export interface UserRegistrationData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  profession: string;
  location: string;
}

export interface ProfessionalRegistrationData extends UserRegistrationData {
  businessName: string;
  vat: string;
  profession: string;
  website: string;
  bio: string;
  address: string;
  addressNumber: string;
  area: string;
  zip: string;
  city: string;
  country: string;
  profileImageBase64?: string;
  latitude?: number;
  longitude?: number;
  serviceName: string;
  serviceDesc: string;
  serviceDuration: number;
  servicePrice: number;
}

interface AuthContextValue {
  user: FirebaseUser | null;
  userProfile: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signUpUser: (data: UserRegistrationData) => Promise<void>;
  signUpProfessional: (data: ProfessionalRegistrationData) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const docRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          setUserProfile(docSnap.exists() ? (docSnap.data() as User) : null);
        } catch {
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const signUpUser = async (data: UserRegistrationData) => {
    const { user: firebaseUser } = await createUserWithEmailAndPassword(
      auth,
      data.email,
      data.password
    );

    const userDoc: User = {
      uid: firebaseUser.uid,
      email: data.email,
      role: 'user',
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      profession: data.profession,
      location: data.location,
      friends: [],
      pendingRequests: [],
    };

    await setDoc(doc(db, 'users', firebaseUser.uid), userDoc);
  };

  const signUpProfessional = async (data: ProfessionalRegistrationData) => {
    const { user: firebaseUser } = await createUserWithEmailAndPassword(
      auth,
      data.email,
      data.password
    );

    const service: Service =
      data.serviceName.trim() || data.serviceDesc || data.servicePrice > 0
        ? {
            name: data.serviceName.trim() || 'Υπηρεσία',
            desc: data.serviceDesc,
            price: data.servicePrice,
            duration: data.serviceDuration,
          }
        : { name: '', desc: '', price: 0, duration: 0 };

    const proDoc: Professional = {
      uid: firebaseUser.uid,
      email: data.email,
      role: 'pro',
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      profession: data.profession,
      location: data.location,
      friends: [],
      pendingRequests: [],
      businessName: data.businessName,
      vat: data.vat,
      website: data.website,
      bio: data.bio,
      address: data.address,
      addressNumber: data.addressNumber,
      area: data.area,
      zip: data.zip,
      city: data.city,
      country: data.country,
      profileImageBase64: data.profileImageBase64,
      latitude: data.latitude,
      longitude: data.longitude,
      services: service.name ? [service] : [],
      ratingAvg: 0,
      totalReviews: 0,
    };

    await setDoc(doc(db, 'users', firebaseUser.uid), proDoc);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const value: AuthContextValue = {
    user,
    userProfile,
    loading,
    signIn,
    sendPasswordReset,
    signUpUser,
    signUpProfessional,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
