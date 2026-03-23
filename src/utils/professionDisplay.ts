/**
 * Εμφάνιση επαγγέλματος στο UI: raw Firestore / κλειδιά τύπου data.professions.plumber → ελληνική ετικέτα (χωρίς εικονίδια).
 */
const I18N_SLUG_LABELS: Record<string, string> = {
  plumber: 'Υδραυλικός',
  electrician: 'Ηλεκτρολόγος',
  hvac: 'Κλιματισμός / HVAC',
  carpenter: 'Ξυλουργός',
  painter: 'Βαφέας',
  landscaper: 'Κηπουρός',
  gardener: 'Κηπουρός',
  developer: 'Developer',
  mobile_developer: 'Mobile Developer',
  lawyer: 'Δικηγόρος',
  attorney: 'Δικηγόρος',
  doctor: 'Ιατρός',
  physician: 'Ιατρός',
  accountant: 'Λογιστής',
};

function normalizeSlug(raw: string): string {
  return raw.toLowerCase().replace(/-/g, '_');
}

function parseI18nProfessionSlug(stored: string): string | undefined {
  const t = stored.trim();
  if (!t) return undefined;

  const patterns: RegExp[] = [
    /^data\.professions\.([a-z0-9_-]+)$/i,
    /^professions\.([a-z0-9_-]+)$/i,
    /^professions_([a-z0-9_-]+)$/i,
    /\.professions\.([a-z0-9_-]+)$/i,
    /\.professions_([a-z0-9_-]+)$/i,
  ];

  for (const re of patterns) {
    const m = t.match(re);
    if (m?.[1]) return normalizeSlug(m[1]);
  }

  return undefined;
}

function humanizeUnknownSlug(slug: string): string {
  return slug
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function professionDisplayForStored(storedName: string): { label: string } {
  const trimmed = (storedName ?? '').trim();
  if (!trimmed) return { label: '' };

  const slug = parseI18nProfessionSlug(trimmed);
  if (slug) {
    const mapped = I18N_SLUG_LABELS[slug];
    if (mapped) return { label: mapped };
    return { label: humanizeUnknownSlug(slug) };
  }

  return { label: trimmed };
}
