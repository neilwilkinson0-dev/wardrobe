"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { describeOutfitPhoto, type OutfitSlotDescription } from "@/lib/anthropic/describeOutfit";
import { rankCandidates, type MatchCandidate } from "@/lib/wear/matchCandidates";

const OUTFIT_ROLES = ["top", "bottom", "footwear", "outer_layer"] as const;
type OutfitRole = (typeof OUTFIT_ROLES)[number];

export interface SlotResult {
  role: OutfitRole;
  description: string;
  candidates: { id: string; subcategory: string | null; thumbnailUrl: string | null; score: number }[];
}

export type SnapState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "described"; slots: SlotResult[] };

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export async function describeSnapAction(
  _prevState: SnapState,
  formData: FormData,
): Promise<SnapState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Not signed in." };

  const photoPath = formData.get("photoPath");
  if (typeof photoPath !== "string" || !photoPath) {
    return { status: "error", message: "Missing uploaded photo — try again." };
  }

  const { data: photoBlob, error: downloadError } = await supabase.storage
    .from("originals")
    .download(photoPath);
  if (downloadError || !photoBlob) {
    return { status: "error", message: `Couldn't read the uploaded photo: ${downloadError?.message ?? "not found"}` };
  }
  const photoBuffer = Buffer.from(await photoBlob.arrayBuffer());

  let description;
  try {
    description = await describeOutfitPhoto(photoBuffer);
  } catch (err) {
    return {
      status: "error",
      message: `Couldn't read the outfit photo: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  } finally {
    // Ephemeral — only exists to inform this one match, never stored on an item.
    await supabase.storage.from("originals").remove([photoPath]);
  }

  if (!description) {
    return { status: "error", message: "Auto-matching is off (no ANTHROPIC_API_KEY set)." };
  }

  const { data: items } = await supabase
    .from("items")
    .select(
      "id, subcategory, colours, pattern, cutout_path, original_photo_path, categories(role)",
    )
    .eq("retired", false);

  const { data: wearEvents } = await supabase
    .from("wear_events")
    .select("item_id, worn_on")
    .not("item_id", "is", null);

  const wearStats = new Map<string, { lastWorn: string | null; count: number }>();
  for (const event of wearEvents ?? []) {
    if (!event.item_id) continue;
    const existing = wearStats.get(event.item_id) ?? { lastWorn: null, count: 0 };
    existing.count += 1;
    if (!existing.lastWorn || event.worn_on > existing.lastWorn) existing.lastWorn = event.worn_on;
    wearStats.set(event.item_id, existing);
  }

  const today = new Date();
  const byRole = (role: OutfitRole): MatchCandidate[] =>
    (items ?? [])
      .filter((item) => item.categories?.role === role)
      .map((item) => {
        const stats = wearStats.get(item.id);
        return {
          id: item.id,
          subcategory: item.subcategory,
          colours: item.colours as MatchCandidate["colours"],
          pattern: item.pattern,
          cutout_path: item.cutout_path,
          original_photo_path: item.original_photo_path,
          daysSinceWorn: stats?.lastWorn ? daysBetween(new Date(stats.lastWorn), today) : Infinity,
          wearCount: stats?.count ?? 0,
        };
      });

  const slots: SlotResult[] = [];
  const descriptionsByRole: Record<OutfitRole, OutfitSlotDescription | null> = {
    top: description.top,
    bottom: description.bottom,
    footwear: description.footwear,
    outer_layer: description.outer_layer,
  };

  for (const role of OUTFIT_ROLES) {
    const slotDescription = descriptionsByRole[role];
    if (!slotDescription) continue;

    const ranked = rankCandidates(slotDescription, byRole(role)).slice(0, 5);
    const withThumbnails = await Promise.all(
      ranked.map(async (c) => {
        const bucket = c.cutout_path ? "cutouts" : "originals";
        const path = c.cutout_path ?? c.original_photo_path;
        const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
        return { id: c.id, subcategory: c.subcategory, thumbnailUrl: signed?.signedUrl ?? null, score: c.score };
      }),
    );

    slots.push({ role, description: slotDescription.description, candidates: withThumbnails });
  }

  if (slots.length === 0) {
    return { status: "error", message: "Couldn't identify any garments in that photo — try a clearer shot." };
  }

  return { status: "described", slots };
}

export async function logSnapWearAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const wornOn = (formData.get("wornOn") as string | null) || new Date().toISOString().slice(0, 10);

  // Each role is its own radio group (sharing one field name would merge them
  // into a single mutually-exclusive group in the browser), so read them
  // individually rather than a single repeated field.
  const itemIds = OUTFIT_ROLES.map((role) => formData.get(role)).filter(
    (v): v is string => typeof v === "string" && v !== "",
  );

  if (itemIds.length > 0) {
    await supabase
      .from("wear_events")
      .insert(itemIds.map((itemId) => ({ item_id: itemId, worn_on: wornOn })));
  }

  redirect("/");
}
