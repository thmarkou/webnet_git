/**
 * Απλή επικύρωση ελληνικού τηλεφώνου (κινητό / σταθερό).
 * Αποδέχεται κενά, +30, αρχικό 0.
 */
export function normalizeGreekPhoneDigits(input: string): string {
  let s = input.replace(/\s/g, '');
  if (s.startsWith('+30')) s = s.slice(3);
  if (s.startsWith('0030')) s = s.slice(4);
  if (s.startsWith('0') && s.length >= 10) s = s.slice(1);
  return s.replace(/\D/g, '');
}

export function isValidGreekPhone(input: string): boolean {
  const d = normalizeGreekPhoneDigits(input);
  if (d.length < 10 || d.length > 11) return false;
  if (d.startsWith('69') && d.length === 10) return true;
  if (d.startsWith('2') && d.length >= 10) return true;
  if (d.startsWith('6') && d.length === 10) return true;
  return false;
}
