"use client";

import { useActionState } from "react";
import { updateItemAction, type UpdateItemState } from "./actions";
import type { Tables } from "@/lib/supabase/types";

type Item = Tables<"items">;

const initialState: UpdateItemState = { status: "idle" };

export default function ItemDetailForm({ item }: { item: Item }) {
  const [state, formAction, pending] = useActionState(updateItemAction, initialState);
  const colours = (item.colours as { dominant?: string[]; secondary?: string[] } | null) ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="itemId" value={item.id} />

      <label className="flex flex-col gap-1 text-sm font-medium">
        Subcategory
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
          <input
            type="text"
            name="pattern"
            defaultValue={item.pattern ?? ""}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Formality
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
          <input
            type="text"
            name="silhouette"
            defaultValue={item.silhouette ?? ""}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Season
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
          <input
            type="text"
            name="material"
            defaultValue={item.material ?? ""}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Care
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
          <input
            type="text"
            name="brand"
            defaultValue={item.brand ?? ""}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Size
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
