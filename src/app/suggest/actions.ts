"use server";

import { createClient } from "@/lib/supabase/server";
import { getForecast } from "@/lib/weather/getForecast";
import { generateSuggestion, type SuggestedItem } from "@/lib/suggestions/generate";

export type SuggestState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      name: string;
      reasoning: string;
      items: SuggestedItem[];
      notices: string[];
      usedWeather: boolean;
    };

export async function getSuggestionAction(
  _prevState: SuggestState,
  formData: FormData,
): Promise<SuggestState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Not signed in." };

  const occasion = (formData.get("occasion") as string | null)?.trim() || "normal day";
  const latRaw = formData.get("lat");
  const lonRaw = formData.get("lon");
  const lat = typeof latRaw === "string" && latRaw ? Number(latRaw) : null;
  const lon = typeof lonRaw === "string" && lonRaw ? Number(lonRaw) : null;

  const weather = lat !== null && lon !== null ? await getForecast(lat, lon) : null;

  const result = await generateSuggestion({ supabase, occasion, weather });

  if ("error" in result) {
    return { status: "error", message: result.error };
  }

  return {
    status: "ready",
    name: result.name,
    reasoning: result.reasoning,
    items: result.items,
    notices: result.notices,
    usedWeather: weather !== null,
  };
}
