/**
 * v1 is invite-only: only emails listed in ALLOWED_EMAILS may sign in, even though
 * Google auth itself would let anyone with a Google account through. Comma-separated
 * in the env var, e.g. "neil@example.com,pilla@example.com". An empty/unset list
 * denies everyone rather than defaulting open.
 */
export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;

  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return allowed.includes(email.toLowerCase());
}
