/**
 * Checks whether a given email address is in the ADMIN_EMAILS env var.
 * ADMIN_EMAILS is a comma-separated list of email addresses, e.g.:
 *   ADMIN_EMAILS=admin@example.com,ops@example.com
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.ADMIN_EMAILS ?? "";
  if (!raw.trim()) return false;
  const admins = raw.split(",").map((e) => e.trim().toLowerCase());
  return admins.includes(email.toLowerCase());
}
