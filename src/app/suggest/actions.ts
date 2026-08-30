"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getForecast, type Forecast } from "@/lib/weather/getForecast";
import { generateSuggestion, type SuggestedItem } from "@/lib/suggestions/generate";
import { distillStylePrinciples } from "@/lib/anthropic/distillPreferences";
import type { Json } from "@/lib/supabase/types";

const DISTILL_EVERY_N_FEEDBACK = 5;

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
      weather: Forecast | null;
      occasion: string;
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
    weather,
    occasion,
  };
}

export type FeedbackState = { status: "idle" } | { status: "submitted" } | { status: "error"; message: string };

async function runDistillation(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: feedback } = await supabase
    .from("feedback")
    .select("rating, quick_reasons, freeform, context")
    .order("created_at", { ascending: false })
    .limit(20);

  const principles = await distillStylePrinciples(feedback ?? []);
  if (principles) {
    // RLS already scopes this to the current user's single preferences row.
    await supabase.from("preferences").update({ style_principles: principles });
  }
}

export async function submitFeedbackAction(
  _prevState: FeedbackState,
  formData: FormData,
): Promise<FeedbackState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Not signed in." };

  const name = formData.get("name") as string | null;
  const itemIds = formData.getAll("itemId").filter((v): v is string => typeof v === "string");
  const ratingRaw = formData.get("rating");
  const rating = typeof ratingRaw === "string" ? Number(ratingRaw) : null;
  const quickReasons = formData.getAll("quickReason").filter((v): v is string => typeof v === "string");
  const freeform = (formData.get("freeform") as string | null)?.trim() || null;
  const occasion = formData.get("occasion") as string | null;
  const weatherRaw = formData.get("weather") as string | null;

  let weather: Json = null;
  if (weatherRaw) {
    try {
      weather = JSON.parse(weatherRaw);
    } catch {
      weather = null;
    }
  }

  if (!rating) {
    return { status: "error", message: "Missing rating." };
  }

  const { error: insertError } = await supabase.from("feedback").insert({
    suggestion_ref: { name, item_ids: itemIds },
    rating,
    quick_reasons: quickReasons.length > 0 ? quickReasons : null,
    freeform,
    context: { weather, occasion },
  });

  if (insertError) {
    return { status: "error", message: `Couldn't save feedback: ${insertError.message}` };
  }

  const { count } = await supabase
    .from("feedback")
    .select("id", { count: "exact", head: true });

  if (count && count % DISTILL_EVERY_N_FEEDBACK === 0) {
    after(() => runDistillation(supabase));
  }

  return { status: "submitted" };
}
