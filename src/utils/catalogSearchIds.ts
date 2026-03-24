/**
 * Φίλτρα αναζήτησης επαγγελματιών με IDs καταλόγου (Firestore) + συμβατότητα με παλιά δεδομένα (μόνο κείμενο).
 */
import type { Professional } from '../api/types';
import type { CityOption } from '../constants/data';

export type CatalogProfession = { id: string; name: string };

export function normCatalogKey(s: string): string {
  return s.trim().toLowerCase();
}

export function proMatchesProfessionFilter(
  pro: Professional,
  filterProfessionId: string,
  professionCatalog: CatalogProfession[]
): boolean {
  if (!filterProfessionId.trim()) return true;
  if (pro.professionId && pro.professionId === filterProfessionId) return true;
  const row = professionCatalog.find((p) => p.id === filterProfessionId);
  if (row && normCatalogKey(pro.profession) === normCatalogKey(row.name)) return true;
  return normCatalogKey(pro.profession) === normCatalogKey(filterProfessionId);
}

/** Canonical id για πόλη στο UI: Firestore doc id ή ετικέτα (ενσωματωμένο catalog). */
export function cityOptionValue(c: CityOption): string {
  return c.firestoreId ?? c.label;
}

export function proMatchesCityFilter(
  pro: Professional,
  filterCityId: string,
  cities: CityOption[]
): boolean {
  if (!filterCityId.trim()) return true;
  if (pro.cityId && pro.cityId === filterCityId) return true;
  for (const c of cities) {
    const cid = cityOptionValue(c);
    if (cid === filterCityId && normCatalogKey(pro.city) === normCatalogKey(c.label)) return true;
  }
  return normCatalogKey(pro.city) === normCatalogKey(filterCityId);
}
