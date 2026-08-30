"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processNewItem } from "@/lib/items/processNewItem";

export type QuickAddState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "added"; itemId: string };

export async function quickAddItemAction(
  _prevState: QuickAddState,
  formData: FormData,
): Promise<QuickAddState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Not signed in." };

  const originalPhotoPath = formData.get("originalPhotoPath");
  if (typeof originalPhotoPath !== "string" || !originalPhotoPath) {
    return { status: "error", message: "Missing uploaded photo — try again." };
  }
  const labelPhotoPathRaw = formData.get("labelPhotoPath");
  const labelPhotoPath =
    typeof labelPhotoPathRaw === "string" && labelPhotoPathRaw ? labelPhotoPathRaw : null;

  const { data: item, error: insertError } = await supabase
    .from("items")
    .insert({
      original_photo_path: originalPhotoPath,
      classification_status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !item) {
    return {
      status: "error",
      message: `Couldn't save item: ${insertError?.message ?? "unknown error"}`,
    };
  }

  after(() =>
    processNewItem({
      userId: user.id,
      itemId: item.id,
      originalPhotoPath,
      labelPhotoPath,
    }),
  );

  return { status: "added", itemId: item.id };
}
