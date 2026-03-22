/**
 * Helper to get Image source URI from profile image (Base64 or URL).
 * Treats null/empty/1×1 placeholder as «no photo» → Lucide placeholders in UI.
 */
const TINY_PLACEHOLDER_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export function hasDisplayableProfileImage(pro: {
  profileImageBase64?: string | null;
  profileImage?: string;
}): boolean {
  if (pro.profileImage != null && String(pro.profileImage).trim() !== '') {
    return true;
  }
  const b64 = pro.profileImageBase64;
  if (b64 == null || b64 === '') return false;
  const t = String(b64).trim();
  if (t === TINY_PLACEHOLDER_B64) return false;
  return true;
}

export function getProfileImageUri(pro: {
  profileImageBase64?: string | null;
  profileImage?: string;
}): string | undefined {
  if (!hasDisplayableProfileImage(pro)) return undefined;
  if (pro.profileImageBase64) {
    return `data:image/jpeg;base64,${pro.profileImageBase64}`;
  }
  return pro.profileImage;
}
