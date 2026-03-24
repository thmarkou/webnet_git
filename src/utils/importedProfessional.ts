import type { Professional, ProfileDisplayType, Service } from '../api/types';
import {
  parseServicePriceBasisFromImport,
} from './servicePricing';

function profileDisplayTypeFromImport(raw: unknown): ProfileDisplayType {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'female' || s === 'γυναίκα' || s === 'γυναικα' || s === 'woman') return 'female';
  if (s === 'company' || s === 'εταιρεία' || s === 'εταιρεια' || s === 'corp') return 'company';
  return 'male';
}

function servicesFromImportData(data: Record<string, unknown>): Service[] {
  const name = String(data.serviceName ?? '').trim();
  const desc = String(data.serviceDesc ?? '').trim();
  const priceRaw = data.servicePrice;
  const price =
    typeof priceRaw === 'number' && Number.isFinite(priceRaw)
      ? priceRaw
      : parseFloat(String(priceRaw ?? '').replace(',', '.')) || 0;
  const basis = parseServicePriceBasisFromImport(data.servicePriceBasis);
  const est = String(data.serviceTimeEstimate ?? '').trim();
  if (!name && !desc && price <= 0 && !est) return [];
  return [
    {
      name: name || 'Υπηρεσία',
      desc,
      price,
      priceBasis: basis,
      ...(est ? { timeEstimate: est } : {}),
    },
  ];
}

/** Έγγραφα από συλλογή `importedProfessionals` (Excel + geocode ή παλιά ελάχιστα πεδία). */
export function mapImportedProfessionalDoc(
  id: string,
  data: Record<string, unknown>
): Professional {
  const businessName = String(data.businessName ?? data.name ?? '').trim() || 'Επαγγελματίας';
  let firstName = String(data.firstName ?? '').trim();
  let lastName = String(data.lastName ?? '').trim();
  if (!firstName && !lastName) {
    const tokens = businessName.split(/\s+/).filter(Boolean);
    firstName = tokens[0] ?? businessName;
    lastName = tokens.length > 1 ? tokens.slice(1).join(' ') : '';
  }
  if (!firstName) firstName = businessName;
  if (!lastName) lastName = '—';

  const lat = Number(data.latitude);
  const lng = Number(data.longitude);
  const tenantIdRaw = data.tenantId;
  const tenantId =
    typeof tenantIdRaw === 'string' && tenantIdRaw.trim() !== '' ? tenantIdRaw.trim() : undefined;

  const vatRaw = String(data.vat ?? '').replace(/\D/g, '');
  const vat = vatRaw.length === 9 ? vatRaw : '000000000';

  const services = servicesFromImportData(data);

  const professionIdRaw = data.professionId;
  const cityIdRaw = data.cityId;

  return {
    uid: id,
    email: String(data.email ?? ''),
    role: 'pro',
    firstName,
    lastName,
    phone: String(data.phone ?? ''),
    profession: String(data.profession ?? ''),
    ...(typeof professionIdRaw === 'string' && professionIdRaw.trim()
      ? { professionId: professionIdRaw.trim() }
      : {}),
    location: `${String(data.city ?? '')}, ${String(data.country ?? 'Ελλάδα')}`,
    friends: [],
    pendingRequests: [],
    businessName,
    vat,
    website: String(data.website ?? ''),
    bio: String(data.bio ?? ''),
    address: String(data.address ?? ''),
    addressNumber: String(data.addressNumber ?? ''),
    area: String(data.area ?? ''),
    zip: String(data.zip ?? ''),
    city: String(data.city ?? ''),
    ...(typeof cityIdRaw === 'string' && cityIdRaw.trim() ? { cityId: cityIdRaw.trim() } : {}),
    country: String(data.country ?? 'Ελλάδα'),
    profileDisplayType: profileDisplayTypeFromImport(data.profileDisplayType),
    profileImageBase64: null,
    latitude: Number.isFinite(lat) ? lat : undefined,
    longitude: Number.isFinite(lng) ? lng : undefined,
    services,
    ratingAvg: 0,
    totalReviews: 0,
    imported: true,
    ...(tenantId ? { tenantId } : {}),
  };
}
