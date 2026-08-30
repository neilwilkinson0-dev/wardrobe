"use client";

import { useActionState, useState } from "react";
import { updateItemAction, type UpdateItemState } from "./actions";
import type { Tables } from "@/lib/supabase/types";

type Item = Tables<"items">;
interface Category {
  id: string;
  name: string;
  role: string;
}

const ROLES = ["top", "bottom", "footwear", "outer_layer", "accessory"] as const;
const initialState: UpdateItemState = { status: "idle" };

function ConfidenceBadge({ confidence, field }: { confidence: unknown; field: string }) {
  const map = confidence as Record<string, string> | null;
  const level = map?.[field];
  if (!level) return null;
  return (
    <span
      className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
        level === "solid" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
      }`}
    >
      {level === "solid" ? "from label" : "best guess"}
    </span>
  );
}

export default function ItemDetailForm({
  item,
  categories,
}: {
  item: Item;
  categories: Category[];
}) {
  const [state, formAction, pending] = useActionState(updateItemAction, initialState);
  const colours = (item.colours as { dominant?: string[]; secondary?: string[] } | null) ?? {};
  const [categoryMode, setCategoryMode] = useState<"existing" | "new">("existing");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="itemId" value={item.id} />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Category</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={categoryMode === "existing"}
              onChange={() => setCategoryMode("existing")}
            />
            Existing
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={categoryMode === "new"}
              onChange={() => setCategoryMode("new")}
            />
            New category
          </label>
        </div>
        <input type="hidden" name="categoryMode" value={categoryMode} />

        {categoryMode === "existing" ? (
          <select
            name="existingCategoryId"
            defaultValue={item.category_id ?? ""}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          >
            <option value="">Uncategorised</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              name="newCategoryName"
              placeholder="Name"
              required
              className="flex-1 rounded-md border border-neutral-300 p-2 text-sm"
            />
            <select
              name="newCategoryRole"
              defaultValue=""
              required
              className="rounded-md border border-neutral-300 p-2 text-sm"
            >
              <option value="" disabled>
                Role
              </option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        )}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Subcategory
        <ConfidenceBadge confidence={item.confidence} field="subcategory" />
        <input
          type="text"
          name="subcategory"
          defaultValue={item.subcategory ?? ""}
          className="rounded-md border border-neutral-300 p-2 text-sm"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Dominant colours
          <input
            type="text"
            name="coloursDominant"
            defaultValue={colours.dominant?.join(", ") ?? ""}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Secondary colours
          <input
            type="text"
            name="coloursSecondary"
            defaultValue={colours.secondary?.join(", ") ?? ""}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Pattern
          <ConfidenceBadge confidence={item.confidence} field="pattern" />
          <input
            type="text"
            name="pattern"
            defaultValue={item.pattern ?? ""}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Formality
          <ConfidenceBadge confidence={item.confidence} field="formality" />
          <input
            type="text"
            name="formality"
            defaultValue={item.formality ?? ""}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Silhouette
          <ConfidenceBadge confidence={item.confidence} field="silhouette" />
          <input
            type="text"
            name="silhouette"
            defaultValue={item.silhouette ?? ""}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Season
          <ConfidenceBadge confidence={item.confidence} field="season_suitability" />
          <input
            type="text"
            name="seasonSuitability"
            defaultValue={item.season_suitability ?? ""}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Material
          <ConfidenceBadge confidence={item.confidence} field="material" />
          <input
            type="text"
            name="material"
            defaultValue={item.material ?? ""}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Care
          <ConfidenceBadge confidence={item.confidence} field="care" />
          <input
            type="text"
            name="care"
            defaultValue={item.care ?? ""}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Brand
          <ConfidenceBadge confidence={item.confidence} field="brand" />
          <input
            type="text"
            name="brand"
            defaultValue={item.brand ?? ""}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Size
          <ConfidenceBadge confidence={item.confidence} field="size" />
          <input
            type="text"
            name="size"
            defaultValue={item.size ?? ""}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Price paid
        <input
          type="number"
          step="0.01"
          name="price"
          defaultValue={item.price ?? ""}
          className="rounded-md border border-neutral-300 p-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Where/when acquired
        <input
          type="text"
          name="acquiredNote"
          defaultValue={item.acquired_note ?? ""}
          className="rounded-md border border-neutral-300 p-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Notes
        <textarea
          name="notes"
          rows={2}
          defaultValue={item.notes ?? ""}
          className="rounded-md border border-neutral-300 p-2 text-sm"
        />
      </label>

      {state.status === "error" && (
        <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-black px-6 py-3 text-base font-medium text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
