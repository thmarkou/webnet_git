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
  /** Σύνδεση με `professions/{id}` — κρίσιμο για κοινωνική αναζήτηση / φίλτρα */
  professionId?: string;
  location: string;
  friends: string[];
  /** UIDs επαγγελματιών που ο χρήστης έχει αποθηκεύσει ως αγαπημένους */
  favorites?: string[];
  pendingRequests: string[];
  /** Multi-tenant: απαιτείται για πρόσβαση σε tenant-scoped δεδομένα (εκτός Super Admin) */
  tenantId?: string;
  /** Φωτογραφία προφίλ (URL ή base64 μέσω `profileImageBase64`) */
  profileImage?: string;
  profileImageBase64?: string | null;
  /** Ημερομηνία εγγραφής (νέα εγγραφή — για analytics) */
  createdAt?: FirestoreTimestampish;
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
  /** Σύνδεση με `cities/{id}` — κρίσιμο για κοινωνική αναζήτηση / φίλτρα */
  cityId?: string;
  country: string;
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

export type AppointmentStatus = 'pending' | 'confirmed' | 'declined' | 'past';

export interface Appointment {
  id: string;
  userId: string;
  proId: string;
  date: Date | { seconds: number; nanoseconds: number };
  status: AppointmentStatus;
  price: number;
}

export type NotificationType =
  | 'friend_request'
  | 'chat_message'
  | 'appointment_request'
  | 'appointment_confirmed'
  | 'appointment_declined';

export interface NotificationDoc {
  id?: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt?: FirestoreTimestampish;
  chatId?: string;
  appointmentId?: string;
  fromUserId?: string;
}

export interface Review {
  id?: string;
  /** Ίδιο με professionalId — uid επαγγελματία */
  proId: string;
  professionalId?: string;
  userId: string;
  reviewerId?: string;
  reviewerName?: string;
  stars: number;
  comment: string;
  timestamp?: Date | { seconds: number; nanoseconds: number };
}

/** `users/{toUid}/friend_requests/{fromUid}` — αίτημα φιλίας (pending μέχρι αποδοχή). */
export interface FriendRequestDoc {
  fromUid: string;
  toUid: string;
  status: 'pending';
  fromFirstName: string;
  fromLastName: string;
  fromPhone?: string;
  createdAt?: FirestoreTimestampish;
}
