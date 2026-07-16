// Phones are stored E.164-style: '+' followed by 7–15 digits. Bare 10-digit
// input is treated as NANP (+1) to match the client's default country code.
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (hasPlus) {
    if (digits.length < 7 || digits.length > 15) return null;
    return `+${digits}`;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}
