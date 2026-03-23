/**
 * API module exports
 * Central export point for Firebase config and API utilities
 */
export { app, auth, db, storage } from './firebaseConfig';
export {
  normalizeUserProfileFromFirestore,
  finiteCoordsOrUndefined,
  setUserRootCoordinates,
} from './userDocument';
export type {
  User,
  Professional,
  UserRole,
  Service,
  ServicePriceBasis,
  Appointment,
  AppointmentStatus,
  Review,
} from './types';
