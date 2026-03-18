/**
 * API module exports
 * Central export point for Firebase config and API utilities
 */
export { app, auth, db, storage } from './firebaseConfig';
export type {
  User,
  Professional,
  UserRole,
  Service,
  Appointment,
  AppointmentStatus,
  Review,
} from './types';
