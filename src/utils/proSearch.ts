import type { Professional } from '../api/types';

/** Ελάχιστη τιμή υπηρεσίας (>0) για φίλτρα / ταξινόμηση */
export function minServicePrice(pro: Professional): number {
  const prices = (pro.services ?? []).map((s) => s.price).filter((p) => p > 0);
  if (prices.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...prices);
}

/** Πλήρης διεύθυνση για κάρτα αναζήτησης */
export function formatProfessionalAddress(pro: Professional): string {
  const street = [pro.address, pro.addressNumber].filter(Boolean).join(' ').trim();
  const rest = [pro.area, pro.zip, pro.city].filter(Boolean).join(', ');
  const parts = [street, rest].filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}
