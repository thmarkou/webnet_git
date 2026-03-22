/**
 * Firestore collection schemas for webnet_db
 */

export type UserRole = 'user' | 'pro';

export interface Service {
  name: string;
  desc: string;
  price: number;
  duration: number; // minutes
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
  /** Τύπος προφίλ για placeholder avatar (Άνδρας / Γυναίκα / Εταιρεία) */
  profileDisplayType?: ProfileDisplayType;
  latitude?: number;
  longitude?: number;
  services: Service[];
  ratingAvg: number;
  totalReviews: number;
  /** Διαθέσιμος σήμερα (μελλοντικό / χειροκίνητο πεδίο) */
  availableToday?: boolean;
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
