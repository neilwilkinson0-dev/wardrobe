"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SaveOutfitState = { status: "idle" } | { status: "error"; message: string };

export async function saveOutfitAction(
  _prevState: SaveOutfitState,
  formData: FormData,
): Promise<SaveOutfitState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Not signed in." };

  const name = (formData.get("name") as string | null)?.trim();
  const itemIds = formData.getAll("itemId").filter((v): v is string => typeof v === "string");

  if (!name || itemIds.length === 0) {
    return { status: "error", message: "Missing outfit name or items." };
  }

  const { data: outfit, error: outfitError } = await supabase
    .from("outfits")
    .insert({ name, source: "suggested" })
    .select("id")
    .single();

  if (outfitError || !outfit) {
    return { status: "error", message: `Couldn't save outfit: ${outfitError?.message ?? "unknown error"}` };
  }

  const { error: itemsError } = await supabase
    .from("outfit_items")
    .insert(itemIds.map((itemId) => ({ outfit_id: outfit.id, item_id: itemId })));

  if (itemsError) {
    return { status: "error", message: `Couldn't link items: ${itemsError.message}` };
  }

  redirect(`/outfits/${outfit.id}`);
}

export async function renameOutfitAction(formData: FormData) {
  const outfitId = formData.get("outfitId");
  const name = (formData.get("name") as string | null)?.trim();
  if (typeof outfitId !== "string" || !outfitId || !name) return;

  const supabase = await createClient();
  await supabase.from("outfits").update({ name }).eq("id", outfitId);

  revalidatePath(`/outfits/${outfitId}`);
  revalidatePath("/outfits");
}

export async function rateOutfitAction(formData: FormData) {
  const outfitId = formData.get("outfitId");
  const ratingRaw = formData.get("rating");
  if (typeof outfitId !== "string" || !outfitId) return;

  const rating = typeof ratingRaw === "string" ? Number(ratingRaw) : null;
  if (!rating || !Number.isFinite(rating)) return;

  const supabase = await createClient();
  await supabase.from("outfits").update({ rating }).eq("id", outfitId);

  revalidatePath(`/outfits/${outfitId}`);
}

export type LogWearState =
  | { status: "idle" }
  | { status: "logged"; date: string }
  | { status: "error"; message: string };

async function syncLastWornDate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  outfitId: string,
) {
  const { data: latest } = await supabase
    .from("wear_events")
    .select("worn_on")
    .eq("outfit_id", outfitId)
    .order("worn_on", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase
    .from("outfits")
    .update({ last_worn_date: latest?.worn_on ?? null })
    .eq("id", outfitId);
}

export async function logOutfitWearAction(
  _prevState: LogWearState,
  formData: FormData,
): Promise<LogWearState> {
  const outfitId = formData.get("outfitId");
  if (typeof outfitId !== "string" || !outfitId) {
    return { status: "error", message: "Missing outfit." };
  }

  const wornOn = (formData.get("wornOn") as string | null) || new Date().toISOString().slice(0, 10);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("wear_events").insert({ outfit_id: outfitId, worn_on: wornOn });
  if (error) {
    return { status: "error", message: `Couldn't log wear: ${error.message}` };
  }
  await syncLastWornDate(supabase, outfitId);

  revalidatePath(`/outfits/${outfitId}`);
  revalidatePath("/outfits");
  return { status: "logged", date: wornOn };
}

export async function deleteOutfitWearEventAction(formData: FormData) {
  const outfitId = formData.get("outfitId");
  const wearEventId = formData.get("wearEventId");
  if (
    typeof outfitId !== "string" ||
    !outfitId ||
    typeof wearEventId !== "string" ||
    !wearEventId
  ) {
    return;
  }

  const supabase = await createClient();
  await supabase.from("wear_events").delete().eq("id", wearEventId);
  await syncLastWornDate(supabase, outfitId);

  revalidatePath(`/outfits/${outfitId}`);
  revalidatePath("/outfits");
}
