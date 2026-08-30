export type Season = "winter" | "spring" | "summer" | "autumn";

/** Northern-hemisphere meteorological seasons — fine for a UK-based wardrobe. */
export function currentSeason(date: Date = new Date()): Season {
  const month = date.getMonth(); // 0-indexed
  if (month === 11 || month <= 1) return "winter";
  if (month <= 4) return "spring";
  if (month <= 7) return "summer";
  return "autumn";
}
