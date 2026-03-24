import type { Service, ServicePriceBasis } from '../api/types';

/** Εμφανίσεις για τη φόρμα εγγραφής (chip + FormSelect αν χρειαστεί) */
export const SERVICE_PRICE_BASIS_CHIPS: { key: ServicePriceBasis; label: string }[] = [
  { key: 'fixed', label: 'Σταθερή τιμή' },
  { key: 'per_hour', label: 'Ανά ώρα' },
  { key: 'per_visit', label: 'Ανά επίσκεψη' },
  { key: 'on_quote', label: 'Μετά από εκτίμηση' },
];

export function normalizePriceBasis(s: Service): ServicePriceBasis {
  if (s.priceBasis) return s.priceBasis;
  return 'fixed';
}

/** Excel / import: κείμενο στήλης → έγκυρο ServicePriceBasis */
export function parseServicePriceBasisFromImport(raw: unknown): ServicePriceBasis {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const aliases: Record<string, ServicePriceBasis> = {
    fixed: 'fixed',
    σταθερή: 'fixed',
    σταθερα: 'fixed',
    per_hour: 'per_hour',
    perhour: 'per_hour',
    hour: 'per_hour',
    hourly: 'per_hour',
    ωρα: 'per_hour',
    ώρα: 'per_hour',
    ανα_ωρα: 'per_hour',
    ανά_ώρα: 'per_hour',
    per_visit: 'per_visit',
    pervisit: 'per_visit',
    visit: 'per_visit',
    επισκεψη: 'per_visit',
    επίσκεψη: 'per_visit',
    on_quote: 'on_quote',
    quote: 'on_quote',
    εκτιμηση: 'on_quote',
    εκτίμηση: 'on_quote',
  };
  return aliases[s] ?? 'fixed';
}

/** Σύντομο κείμενο τιμής (χωρίς πρόθεμα «Από») */
export function formatServicePriceText(s: Service): string {
  const basis = normalizePriceBasis(s);
  const p = s.price;

  switch (basis) {
    case 'per_hour':
      return p > 0 ? `€${p}/ώρα` : 'Ανά ώρα — τιμή κατόπιν συνεννόησης';
    case 'per_visit':
      return p > 0 ? `€${p}/επίσκεψη` : 'Ανά επίσκεψη — τιμή κατόπιν συνεννόησης';
    case 'on_quote':
      return p > 0 ? `€${p} ενδεικτικά` : 'Κατόπιν εκτίμησης';
    case 'fixed':
    default:
      return p > 0 ? `€${p}` : '—';
  }
}

/** Εκτίμηση χρόνου: νέο πεδίο ή legacy λεπτά */
export function formatServiceTimeOrEstimate(s: Service): string | null {
  const te = (s.timeEstimate ?? '').trim();
  if (te) return te;
  if (s.duration != null && s.duration > 0) return `~${s.duration} λεπτά`;
  return null;
}

/** Τιμή + εκτίμηση σε μία γραμμή */
export function formatServicePriceAndEstimate(s: Service): string {
  const price = formatServicePriceText(s);
  const est = formatServiceTimeOrEstimate(s);
  if (est) return `${price} · ${est}`;
  return price;
}

/** Γραμμή στην κάρτα αναζήτησης */
export function formatSearchCardServiceLine(pro: { services?: Service[] }): string | null {
  const s = pro.services?.[0];
  if (!s?.name?.trim()) return null;
  const pt = formatServicePriceText(s);
  const head = s.price > 0 ? `Από ${pt}` : pt;
  const est = formatServiceTimeOrEstimate(s);
  const tail = est ? ` · ${est}` : '';
  return `${head}${tail} · ${s.name.trim()}`;
}
