/**
 * Rule-based duplicate scoring per spec §6: same category + same colour family +
 * same pattern + similar formality => likely duplicate. Category is a hard gate
 * (different categories are never compared); the rest is scored out of 4.
 * This won't catch subtle weight differences between two black tees, but it will
 * reliably flag "you own five near-identical navy crews".
 */

export interface DuplicateCandidate {
  category_id: string | null;
  colours: { dominant?: string[]; secondary?: string[] } | null;
  pattern: string | null;
  formality: string | null;
}

export const DUPLICATE_SCORE_THRESHOLD = 3;
const MAX_DUPLICATE_SCORE = 4;

function normalizedColours(colours: DuplicateCandidate["colours"]): string[] {
  if (!colours) return [];
  return [...(colours.dominant ?? []), ...(colours.secondary ?? [])].map((c) =>
    c.trim().toLowerCase(),
  );
}

/** Returns 0 if the two items aren't even in the same category. */
export function scoreDuplicate(a: DuplicateCandidate, b: DuplicateCandidate): number {
  if (!a.category_id || !b.category_id || a.category_id !== b.category_id) return 0;

  let score = 0;

  const coloursA = normalizedColours(a.colours);
  const coloursB = normalizedColours(b.colours);
  if (coloursA.some((c) => coloursB.includes(c))) score += 2;

  if (a.pattern && b.pattern && a.pattern.toLowerCase() === b.pattern.toLowerCase()) {
    score += 1;
  }

  if (
    a.formality &&
    b.formality &&
    a.formality.toLowerCase() === b.formality.toLowerCase()
  ) {
    score += 1;
  }

  return score;
}

export function isLikelyDuplicate(a: DuplicateCandidate, b: DuplicateCandidate): boolean {
  return scoreDuplicate(a, b) >= DUPLICATE_SCORE_THRESHOLD;
}

export { MAX_DUPLICATE_SCORE };
