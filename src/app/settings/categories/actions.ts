"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CategoryFormState = { status: "idle" } | { status: "error"; message: string };

const VALID_ROLES = ["top", "bottom", "footwear", "outer_layer", "accessory"];

export async function addCategoryAction(
  _prevState: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const name = (formData.get("name") as string | null)?.trim();
  const role = formData.get("role");

  if (!name) return { status: "error", message: "Name is required." };
  if (typeof role !== "string" || !VALID_ROLES.includes(role)) {
    return { status: "error", message: "Pick a valid role." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("categories").insert({ name, role });

  if (error) {
    return {
      status: "error",
      message: error.code === "23505" ? "You already have a category with that name." : error.message,
    };
  }

  revalidatePath("/settings/categories");
  return { status: "idle" };
}

export async function updateCategoryAction(formData: FormData) {
  const id = formData.get("id");
  const name = (formData.get("name") as string | null)?.trim();
  const role = formData.get("role");

  if (typeof id !== "string" || !id || !name) return;
  if (typeof role !== "string" || !VALID_ROLES.includes(role)) return;

  const supabase = await createClient();
  await supabase.from("categories").update({ name, role }).eq("id", id);

  revalidatePath("/settings/categories");
}

export async function deleteCategoryAction(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  const supabase = await createClient();
  // Items keep their history; the FK is ON DELETE SET NULL so they just become uncategorised.
  await supabase.from("categories").delete().eq("id", id);

  revalidatePath("/settings/categories");
  revalidatePath("/");
}
