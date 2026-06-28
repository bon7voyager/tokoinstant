/**
 * Normalize an Indonesian phone number to "62xxxx" form for WhatsApp.
 * Returns null if the input can't be a valid ID mobile number.
 */
export function normalizePhoneID(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, ""); // strip non-digits
  if (!d) return null;
  if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (d.startsWith("8")) d = "62" + d; // bare local mobile
  else if (!d.startsWith("62")) return null; // unknown country code
  // Collapse a leftover local trunk "0" after the 62 prefix, e.g. "+62 0812..." -> "62 812..."
  if (d.startsWith("620")) d = "62" + d.slice(3);
  if (d.length < 10 || d.length > 15) return null; // sanity bounds
  return d;
}
