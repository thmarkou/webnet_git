/**
 * Helper to get Image source URI from profile image (Base64 or URL)
 */
export function getProfileImageUri(pro: { profileImageBase64?: string; profileImage?: string }): string | undefined {
  if (pro.profileImageBase64) {
    return `data:image/jpeg;base64,${pro.profileImageBase64}`;
  }
  return pro.profileImage;
}
