/**
 * Επιλογές προχωρημένων φίλτρων αναζήτησης
 */

export type RadiusFilterKey = 'all' | '5' | '10' | '20' | '50';

export const RADIUS_FILTER_OPTIONS: { key: RadiusFilterKey; label: string; km: number | null }[] = [
  { key: 'all', label: 'Όλες οι αποστάσεις', km: null },
  { key: '5', label: 'Έως 5 km', km: 5 },
  { key: '10', label: 'Έως 10 km', km: 10 },
  { key: '20', label: 'Έως 20 km', km: 20 },
  { key: '50', label: 'Έως 50 km', km: 50 },
];

export type PriceSortKey = 'none' | 'asc' | 'desc';

export const PRICE_SORT_OPTIONS: { key: PriceSortKey; label: string }[] = [
  { key: 'none', label: 'Χωρίς ταξινόμηση τιμής' },
  { key: 'asc', label: 'Τιμή: χαμηλά → ψηλά' },
  { key: 'desc', label: 'Τιμή: ψηλά → χαμηλά' },
];

export type MinRatingKey = 'any' | '3' | '4' | '5';

export const MIN_RATING_OPTIONS: { key: MinRatingKey; label: string; min: number }[] = [
  { key: 'any', label: 'Όλες οι βαθμολογίες', min: 0 },
  { key: '3', label: '3★ και άνω', min: 3 },
  { key: '4', label: '4★ και άνω', min: 4 },
  { key: '5', label: '5★ μόνο', min: 5 },
];
