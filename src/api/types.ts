/**
 * Firestore collection schemas for webnet_db
 */

export type UserRole = 'user' | 'pro' | 'superadmin';

export type ProAccountStatus = 'trial' | 'subscribed' | 'deactivated';

export type SubscriptionPlanId = 'monthly' | 'yearly';

/** Firestore Timestamp ή απλό object από το SDK */
export type FirestoreTimestampish =
  | { seconds: number; nanoseconds?: number }
  | { toMillis: () => number };

/** Πόλη στο Firestore (συλλογή cities) */
export interface CityDoc {
  name: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  /** Multi-tenant: υποχρεωτικό για νέα δεδομένα */
  tenantId?: string;
}

/** Επάγγελμα στο Firestore (συλλογή professions) */
export interface ProfessionDoc {
  name: string;
  /** Προαιρετικό όνομα εικονιδίου (π.χ. για μελλοντικό UI) */
  icon?: string;
  tenantId?: string;
}

/** Ενοικιαστής (tenant) — συλλογή `tenants` */
export interface TenantDoc {
  tenantId: string;
  displayName: string;
  adminEmail: string;
  /** Firebase Auth uid του tenant admin — για rules χωρίς `request.auth.token.email` στο mobile */
  adminUid?: string | null;
  active: boolean;
  createdAt?: FirestoreTimestampish;
}

/** Πώς ερμηνεύεται το πεδίο `price` */
export type ServicePriceBasis =
  | 'fixed'
  | 'per_hour'
  | 'per_visit'
  | 'on_quote';

export interface Service {
  name: string;
  desc: string;
  price: number;
  priceBasis?: ServicePriceBasis;
  /** Ελεύθερη εκτίμηση χρόνου/εύρους (π.χ. «2–4 ώρες», «ανάλογα τη βλάβη») */
  timeEstimate?: string;
  /** Παλιά εγγραφή: διάρκεια μόνο σε λεπτά — διαβάζεται ακόμα για συμβατότητα */
  duration?: number;
}

export interface User {
  uid: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone: string;
  profession: string;
  location: string;
  friends: string[];
  pendingRequests: string[];
  /** Multi-tenant: απαιτείται για πρόσβαση σε tenant-scoped δεδομένα (εκτός Super Admin) */
  tenantId?: string;
}

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

/** Εικονίδιο placeholder όταν δεν ανέβει φωτο — ορίζεται στην εγγραφή επαγγελματία */
export type ProfileDisplayType = 'male' | 'female' | 'company';

export interface Professional extends User {
  role: 'pro';
  businessName: string;
  profession: string;
  vat: string;
  website: string;
  bio: string;
  address: string;
  addressNumber: string;
  area: string;
  zip: string;
  city: string;
  country: string;
  profileImage?: string;
  /** null = χωρίς φωτογραφία → εικονίδιο Lucide στο UI */
  profileImageBase64?: string | null;
  /**
   * Τύπος προφίλ για avatar χωρίς φωτογραφία (Άνδρας / Γυναίκα / Εταιρεία).
   * Ίδιο νοηματικά με πεδίο «Τύπος» στη φόρμα εγγραφής.
   */
  profileDisplayType?: ProfileDisplayType;
  latitude?: number;
  longitude?: number;
  services: Service[];
  ratingAvg: number;
  totalReviews: number;
  /** Διαθέσιμος σήμερα (μελλοντικό / χειροκίνητο πεδίο) */
  availableToday?: boolean;
  /** Εγγραφή από Excel import (συλλογή importedProfessionals) */
  imported?: boolean;
  /** Λήξη δωρεάν περιόδου (30 ημέρες από εγγραφή) */
  trialEndDate?: FirestoreTimestampish;
  accountStatus?: ProAccountStatus;
  subscriptionPlan?: SubscriptionPlanId | null;
  subscriptionEndsAt?: FirestoreTimestampish;
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'past';

export interface Appointment {
  id: string;
  userId: string;
  proId: string;
  date: Date | { seconds: number; nanoseconds: number };
  status: AppointmentStatus;
  price: number;
}

export interface Review {
  id?: string;
  proId: string;
  userId: string;
  stars: number;
  comment: string;
  timestamp?: Date | { seconds: number; nanoseconds: number };
}
