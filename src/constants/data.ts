/**
 * Στατικό catalog: πόλεις (κέντρο χάρτη / επιλογή φόρμας) και λίστα επαγγελμάτων.
 * Δεν περιέχει χρήστες· οι επαγγελματίες προέρχονται μόνο από Firestore (εγγραφή στην εφαρμογή).
 */
import catalog from './catalog.json';

export type CityOption = {
  label: string;
  latitude: number;
  longitude: number;
  country: string;
};

export const CITIES: readonly CityOption[] = catalog.cities;
export const PROFESSIONS: readonly string[] = catalog.professions;

/** Ετικέτες πόλεων για Picker */
export const CITY_LABELS: readonly string[] = CITIES.map((c) => c.label);

export function getCityByLabel(label: string): CityOption | undefined {
  return CITIES.find((c) => c.label === label);
}

/** Εύρεση πόλης από reverse geocode (ελληνικά / λατινικά ονόματα) */
export function matchCityFromGeocode(geocodeCity: string | null | undefined): CityOption | undefined {
  if (!geocodeCity?.trim()) return undefined;
  const n = geocodeCity.trim().toLowerCase();
  const aliases: [string, string][] = [
    ['αθήνα', 'Αθήνα'],
    ['athens', 'Αθήνα'],
    ['θεσσαλονίκη', 'Θεσσαλονίκη'],
    ['thessaloniki', 'Θεσσαλονίκη'],
    ['πάτρα', 'Πάτρα'],
    ['patras', 'Πάτρα'],
    ['ηράκλειο', 'Ηράκλειο'],
    ['heraklion', 'Ηράκλειο'],
    ['λάρισα', 'Λάρισα'],
    ['larissa', 'Λάρισα'],
    ['ιωάννινα', 'Ιωάννινα'],
    ['ioannina', 'Ιωάννινα'],
    ['νέα μουδανιά', 'Νέα Μουδανιά'],
    ['νεα μουδανια', 'Νέα Μουδανιά'],
    ['nea moudania', 'Νέα Μουδανιά'],
    ['moudania', 'Νέα Μουδανιά'],
  ];
  for (const [key, label] of aliases) {
    if (n.includes(key)) return getCityByLabel(label);
  }
  return CITIES.find((c) => n.includes(c.label.toLowerCase()));
}
