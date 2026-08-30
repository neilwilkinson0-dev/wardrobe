import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { Forecast } from "@/lib/weather/getForecast";
import { currentSeason, type Season } from "./season";

const SUGGESTION_MODEL = "claude-haiku-4-5-20251001";
const OUTFIT_ROLES = ["top", "bottom", "footwear", "outer_layer"] as const;
type OutfitRole = (typeof OUTFIT_ROLES)[number];

interface Candidate {
  id: string;
  role: OutfitRole;
  subcategory: string | null;
  colours: { dominant?: string[]; secondary?: string[] } | null;
  pattern: string | null;
  formality: string | null;
  season_suitability: string | null;
  material: string | null;
  cutout_path: string | null;
  original_photo_path: string;
  daysSinceWorn: number; // Infinity if never worn
}

export interface SuggestedItem {
  id: string;
  role: OutfitRole;
  subcategory: string | null;
  cutout_path: string | null;
  original_photo_path: string;
}

export interface SuggestionResult {
  name: string;
  reasoning: string;
  items: SuggestedItem[];
  notices: string[];
}

function isWeatherAppropriate(
  candidate: Pick<Candidate, "season_suitability" | "material">,
  weather: Forecast | null,
  season: Season,
): boolean {
  const material = candidate.material?.toLowerCase() ?? "";
  const suitability = candidate.season_suitability?.toLowerCase() ?? "";

  if (weather) {
    if (weather.temperatureC < 10 && (material.includes("linen") || suitability === "summer")) {
      return false;
    }
    if (weather.temperatureC > 20 && (material.includes("wool") || suitability === "winter")) {
      return false;
    }
    return true;
  }

  if (!suitability || suitability === "all-season") return true;
  return suitability === season;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function pickMostNeglected(candidates: Candidate[]): Candidate | null {
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => b.daysSinceWorn - a.daysSinceWorn)[0];
}

export async function generateSuggestion(params: {
  supabase: SupabaseClient<Database>;
  occasion: string;
  weather: Forecast | null;
}): Promise<SuggestionResult | { error: string }> {
  const { supabase, occasion, weather } = params;

  const { data: items, error: itemsError } = await supabase
    .from("items")
    .select(
      "id, subcategory, colours, pattern, formality, season_suitability, material, cutout_path, original_photo_path, categories(role)",
    )
    .eq("retired", false);

  if (itemsError) return { error: `Couldn't load your items: ${itemsError.message}` };
  if (!items || items.length === 0) {
    return { error: "Add a few items first — nothing to suggest from yet." };
  }

  const { data: wearEvents } = await supabase
    .from("wear_events")
    .select("item_id, worn_on")
    .not("item_id", "is", null)
    .order("worn_on", { ascending: false });

  const lastWornByItem = new Map<string, string>();
  for (const event of wearEvents ?? []) {
    if (event.item_id && !lastWornByItem.has(event.item_id)) {
      lastWornByItem.set(event.item_id, event.worn_on);
    }
  }

  const today = new Date();
  const season = currentSeason(today);

  const allCandidates: Candidate[] = items
    .filter((item) => {
      const role = item.categories?.role;
      return role && (OUTFIT_ROLES as readonly string[]).includes(role);
    })
    .map((item) => {
      const lastWorn = lastWornByItem.get(item.id);
      return {
        id: item.id,
        role: item.categories!.role as OutfitRole,
        subcategory: item.subcategory,
        colours: item.colours as Candidate["colours"],
        pattern: item.pattern,
        formality: item.formality,
        season_suitability: item.season_suitability,
        material: item.material,
        cutout_path: item.cutout_path,
        original_photo_path: item.original_photo_path,
        daysSinceWorn: lastWorn ? daysBetween(new Date(lastWorn), today) : Infinity,
      };
    });

  const byRole = (role: OutfitRole) =>
    allCandidates.filter((c) => c.role === role && isWeatherAppropriate(c, weather, season));

  const tops = byRole("top");
  const bottoms = byRole("bottom");
  const footwear = byRole("footwear");
  const outerLayers = byRole("outer_layer");

  if (tops.length === 0 || bottoms.length === 0 || footwear.length === 0) {
    return {
      error:
        "Not enough weather-appropriate items yet — need at least one top, one bottom and one pair of shoes.",
    };
  }

  const wantsOuterLayer = weather
    ? weather.temperatureC < 15 || weather.precipitationMm > 0
    : season === "winter";

  const notices: string[] = [];
  let chosen: { top: Candidate; bottom: Candidate; footwear: Candidate; outer: Candidate | null } | null = null;
  let name = "";
  let reasoning = "";

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const client = new Anthropic({ apiKey });
      const describe = (c: Candidate) => ({
        id: c.id,
        subcategory: c.subcategory,
        colours: c.colours,
        pattern: c.pattern,
        formality: c.formality,
        days_since_worn: Number.isFinite(c.daysSinceWorn) ? c.daysSinceWorn : "never worn",
      });

      const { data: preferences } = await supabase
        .from("preferences")
        .select("style_principles, colouring_profile")
        .maybeSingle();

      const message = await client.messages.create({
        model: SUGGESTION_MODEL,
        max_tokens: 512,
        system: `You style one daily outfit from a user's wardrobe for a wardrobe app.

Respond with ONLY a single JSON object, no prose, no markdown fences:
{
  "top_item_id": string,
  "bottom_item_id": string,
  "footwear_item_id": string,
  "outer_layer_item_id": string | null,
  "name": string,     // short, descriptive, e.g. "Navy crew + stone chinos + white trainers"
  "reasoning": string // one or two sentences: why these work together and for today
}

Rules:
- Pick exactly one id from each candidate list given (top/bottom/footwear required, outer layer optional).
- Apply colour-combination theory: complementary, analogous, or tonal pairings; balance one bold piece against quieter ones rather than clashing prints/colours.
- Prefer items with a higher "days_since_worn" (or "never worn") when multiple choices are otherwise similarly valid — the goal is reviving neglected clothes, not just picking favourites.
- Only include an outer layer if one is given and the weather calls for it.`,
        messages: [
          {
            role: "user",
            content: JSON.stringify({
              occasion,
              season,
              weather,
              style_principles: preferences?.style_principles ?? null,
              colouring_profile: preferences?.colouring_profile ?? null,
              wants_outer_layer: wantsOuterLayer,
              candidates: {
                top: tops.map(describe),
                bottom: bottoms.map(describe),
                footwear: footwear.map(describe),
                outer_layer: outerLayers.map(describe),
              },
            }),
          },
        ],
      });

      const textBlock = message.content.find((b) => b.type === "text");
      if (textBlock && textBlock.type === "text") {
        const parsed = JSON.parse(textBlock.text) as {
          top_item_id: string;
          bottom_item_id: string;
          footwear_item_id: string;
          outer_layer_item_id: string | null;
          name: string;
          reasoning: string;
        };

        const top = tops.find((c) => c.id === parsed.top_item_id);
        const bottom = bottoms.find((c) => c.id === parsed.bottom_item_id);
        const shoe = footwear.find((c) => c.id === parsed.footwear_item_id);
        const outer = parsed.outer_layer_item_id
          ? (outerLayers.find((c) => c.id === parsed.outer_layer_item_id) ?? null)
          : null;

        if (top && bottom && shoe) {
          chosen = { top, bottom, footwear: shoe, outer };
          name = parsed.name;
          reasoning = parsed.reasoning;
        }
      }
    } catch (err) {
      notices.push(
        `AI styling failed (${err instanceof Error ? err.message : "unknown error"}) — used a simple pick instead.`,
      );
    }
  } else {
    notices.push("AI styling is off (no ANTHROPIC_API_KEY set) — used a simple pick instead.");
  }

  if (!chosen) {
    const top = pickMostNeglected(tops)!;
    const bottom = pickMostNeglected(bottoms)!;
    const shoe = pickMostNeglected(footwear)!;
    const outer = wantsOuterLayer ? pickMostNeglected(outerLayers) : null;
    chosen = { top, bottom, footwear: shoe, outer };
    name =
      [top.subcategory, bottom.subcategory, shoe.subcategory].filter(Boolean).join(" + ") ||
      "Today's outfit";
    reasoning = "Picked automatically from your most-neglected pieces in each category.";
  }

  const resultItems: SuggestedItem[] = [
    {
      id: chosen.top.id,
      role: "top",
      subcategory: chosen.top.subcategory,
      cutout_path: chosen.top.cutout_path,
      original_photo_path: chosen.top.original_photo_path,
    },
    {
      id: chosen.bottom.id,
      role: "bottom",
      subcategory: chosen.bottom.subcategory,
      cutout_path: chosen.bottom.cutout_path,
      original_photo_path: chosen.bottom.original_photo_path,
    },
    {
      id: chosen.footwear.id,
      role: "footwear",
      subcategory: chosen.footwear.subcategory,
      cutout_path: chosen.footwear.cutout_path,
      original_photo_path: chosen.footwear.original_photo_path,
    },
  ];
  if (chosen.outer) {
    resultItems.push({
      id: chosen.outer.id,
      role: "outer_layer",
      subcategory: chosen.outer.subcategory,
      cutout_path: chosen.outer.cutout_path,
      original_photo_path: chosen.outer.original_photo_path,
    });
  }

  return { name, reasoning, items: resultItems, notices };
}
