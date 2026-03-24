import type { CityOption } from '../constants/data';
import type { Professional, User } from '../api/types';
import { finiteCoordsOrUndefined } from '../api/userDocument';

/**
 * Συντεταγμένες κέντρου πόλης από το catalog Firestore (ή ενσωματωμένο fallback).
 */
export function resolveCityCoordinates(
  cityOrLocation: string | undefined,
  catalog: CityOption[]
): { latitude: number; longitude: number } | null {
  if (!cityOrLocation?.trim()) return null;
  const head = cityOrLocation.trim().split(',')[0].trim();
  const exact =
    catalog.find((c) => c.label === head) ??
    catalog.find((c) => c.label === cityOrLocation.trim());
  if (!exact) return null;
  return { latitude: exact.latitude, longitude: exact.longitude };
}

/** Πόλη «σπιτιού» χρήστη για απόσταση αναζήτησης (επαγγελματίας: πεδίο city, αλλιώς location). */
export function userSearchHomeCityLabel(user: User | null): string {
  if (!user) return '';
  if (user.role === 'pro') {
    const p = user as Professional;
    return (p.city?.trim() || user.location?.split(',')[0].trim() || '').trim();
  }
  return user.location?.split(',')[0].trim() || user.location?.trim() || '';
}

/** Ετικέτα πόλης επαγγελματία για αντιστοίχιση με cities. */
export function professionalCatalogCityLabel(pro: Professional): string {
  return (pro.city?.trim() || pro.location?.split(',')[0].trim() || '').trim();
}

/**
 * Συντεταγμένες για χάρτη: προτεραιότητα σε lat/lng προφίλ, αλλιώς κέντρο πόλης από catalog cities.
 */
export function professionalMapCoordinates(
  pro: Professional,
  catalog: CityOption[]
): { latitude: number; longitude: number } | null {
  const direct = finiteCoordsOrUndefined(pro.latitude, pro.longitude);
  if (direct) return direct;
  return resolveCityCoordinates(professionalCatalogCityLabel(pro), catalog);
}
