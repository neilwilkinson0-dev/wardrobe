"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type UpdateItemState = { status: "idle" } | { status: "error"; message: string };

function readText(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
}

function readList(formData: FormData, key: string): string[] {
  return (
    (formData.get(key) as string | null)
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? []
  );
}

function readNumber(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function updateItemAction(
  _prevState: UpdateItemState,
  formData: FormData,
): Promise<UpdateItemState> {
  const itemId = formData.get("itemId");
  if (typeof itemId !== "string" || !itemId) {
    return { status: "error", message: "Missing item." };
  }

  const supabase = await createClient();

  let categoryId: string | null | undefined;
  const categoryMode = formData.get("categoryMode");
  if (categoryMode === "new") {
    const name = readText(formData, "newCategoryName");
    const role = formData.get("newCategoryRole");
    if (!name || typeof role !== "string" || !role) {
      return { status: "error", message: "New category needs a name and role." };
    }
    const { data: newCategory, error: categoryError } = await supabase
      .from("categories")
      .insert({ name, role })
      .select("id")
      .single();
    if (categoryError || !newCategory) {
      return {
        status: "error",
        message: `Couldn't create category: ${categoryError?.message ?? "unknown error"}`,
      };
    }
    categoryId = newCategory.id;
  } else if (categoryMode === "existing") {
    categoryId = readText(formData, "existingCategoryId");
  }

  // A plain edit never re-runs classification — it only updates the fields the
  // user changed. Re-classifying is reserved for an explicit request or a
  // replaced photo (not yet built).
  const { error } = await supabase
    .from("items")
    .update({
      ...(categoryId !== undefined ? { category_id: categoryId } : {}),
      subcategory: readText(formData, "subcategory"),
      colours: {
        dominant: readList(formData, "coloursDominant"),
        secondary: readList(formData, "coloursSecondary"),
      },
      pattern: readText(formData, "pattern"),
      formality: readText(formData, "formality"),
      silhouette: readText(formData, "silhouette"),
      season_suitability: readText(formData, "seasonSuitability"),
      material: readText(formData, "material"),
      care: readText(formData, "care"),
      brand: readText(formData, "brand"),
      size: readText(formData, "size"),
      price: readNumber(formData, "price"),
      acquired_note: readText(formData, "acquiredNote"),
      notes: readText(formData, "notes"),
    })
    .eq("id", itemId);

  if (error) {
    return { status: "error", message: `Couldn't save: ${error.message}` };
  }

  revalidatePath(`/items/${itemId}`);
  return { status: "idle" };
}

export async function toggleRetiredAction(formData: FormData) {
  const itemId = formData.get("itemId");
  const retired = formData.get("retired") === "true";
  if (typeof itemId !== "string" || !itemId) return;

  const supabase = await createClient();
  await supabase.from("items").update({ retired }).eq("id", itemId);

  revalidatePath(`/items/${itemId}`);
  revalidatePath("/");
}

export async function logWearAction(formData: FormData) {
  const itemId = formData.get("itemId");
  if (typeof itemId !== "string" || !itemId) return;

  const wornOn = readText(formData, "wornOn") ?? new Date().toISOString().slice(0, 10);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("wear_events").insert({
    item_id: itemId,
    worn_on: wornOn,
  });

  revalidatePath(`/items/${itemId}`);
}
