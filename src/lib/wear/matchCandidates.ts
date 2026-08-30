import type { OutfitSlotDescription } from "@/lib/anthropic/describeOutfit";

export interface MatchCandidate {
  id: string;
  subcategory: string | null;
  colours: { dominant?: string[]; secondary?: string[] } | null;
  pattern: string | null;
  cutout_path: string | null;
  original_photo_path: string;
  daysSinceWorn: number; // Infinity if never worn
  wearCount: number;
}

function normalizedColours(colours: MatchCandidate["colours"]): string[] {
  if (!colours) return [];
  return [...(colours.dominant ?? []), ...(colours.secondary ?? [])].map((c) =>
    c.trim().toLowerCase(),
  );
}

function wordsOf(text: string | null): string[] {
  return text ? text.toLowerCase().split(/[^a-z]+/).filter(Boolean) : [];
}

/**
 * Scores how well a candidate wardrobe item matches a described garment.
 * Unlike duplicate scoring or the suggestion engine's neglect bias, this
 * ranks toward what's *plausibly being worn right now* — frequently worn,
 * recently in rotation — since the goal is guessing what's in the photo,
 * not reviving neglected pieces.
 */
export function scoreCandidate(
  description: OutfitSlotDescription,
  candidate: MatchCandidate,
): number {
  let score = 0;

  const descColours = description.colours.map((c) => c.trim().toLowerCase());
  const candColours = normalizedColours(candidate.colours);
  if (descColours.some((c) => candColours.includes(c))) score += 2;

  if (
    description.pattern &&
    candidate.pattern &&
    description.pattern.toLowerCase() === candidate.pattern.toLowerCase()
  ) {
    score += 1;
  }

  const descWords = wordsOf(description.description);
  const subcatWords = wordsOf(candidate.subcategory);
  if (descWords.some((w) => subcatWords.includes(w))) score += 1;

  return score;
}

export interface RankedCandidate {
  id: string;
  subcategory: string | null;
  cutout_path: string | null;
  original_photo_path: string;
  score: number;
}

export function rankCandidates(
  description: OutfitSlotDescription,
  candidates: MatchCandidate[],
): RankedCandidate[] {
  return candidates
    .map((c) => ({ candidate: c, score: scoreCandidate(description, c) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.candidate.wearCount !== a.candidate.wearCount) {
        return b.candidate.wearCount - a.candidate.wearCount;
      }
      return a.candidate.daysSinceWorn - b.candidate.daysSinceWorn;
    })
    .map(({ candidate, score }) => ({
      id: candidate.id,
      subcategory: candidate.subcategory,
      cutout_path: candidate.cutout_path,
      original_photo_path: candidate.original_photo_path,
      score,
    }));
}
