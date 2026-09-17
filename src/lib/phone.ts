/** Phone helpers safe to use in the browser. */

/**
 * A number WhatsApp's wa.me links accept: digits only, with India's country
 * code added to a bare 10-digit mobile number.
 */
export function whatsappNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}
