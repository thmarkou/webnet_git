import type { Professional } from '../api/types';

/** Έγγραφα από συλλογή `importedProfessionals` (μετά από geocode στο Admin). */
export function mapImportedProfessionalDoc(
  id: string,
  data: Record<string, unknown>
): Professional {
  const businessName = String(data.businessName ?? data.name ?? '').trim() || 'Επαγγελματίας';
  const tokens = businessName.split(/\s+/).filter(Boolean);
  const firstName = tokens[0] ?? businessName;
  const lastName = tokens.length > 1 ? tokens.slice(1).join(' ') : '—';
  const lat = Number(data.latitude);
  const lng = Number(data.longitude);
  const tenantIdRaw = data.tenantId;
  const tenantId =
    typeof tenantIdRaw === 'string' && tenantIdRaw.trim() !== '' ? tenantIdRaw.trim() : undefined;
  return {
    uid: id,
    email: String(data.email ?? ''),
    role: 'pro',
    firstName,
    lastName,
    phone: String(data.phone ?? ''),
    profession: String(data.profession ?? ''),
    location: `${String(data.city ?? '')}, ${String(data.country ?? 'Ελλάδα')}`,
    friends: [],
    pendingRequests: [],
    businessName,
    vat: '000000000',
    website: '',
    bio: '',
    address: String(data.address ?? ''),
    addressNumber: '',
    area: '',
    zip: '',
    city: String(data.city ?? ''),
    country: String(data.country ?? 'Ελλάδα'),
    profileDisplayType: 'company',
    profileImageBase64: null,
    latitude: Number.isFinite(lat) ? lat : undefined,
    longitude: Number.isFinite(lng) ? lng : undefined,
    services: [],
    ratingAvg: 0,
    totalReviews: 0,
    imported: true,
    ...(tenantId ? { tenantId } : {}),
  };
}
