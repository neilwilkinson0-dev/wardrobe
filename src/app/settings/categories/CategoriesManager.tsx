"use client";

import { useActionState } from "react";
import {
  addCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  type CategoryFormState,
} from "./actions";
import type { Tables } from "@/lib/supabase/types";

type Category = Tables<"categories">;

const ROLES = ["top", "bottom", "footwear", "outer_layer", "accessory"] as const;
const initialState: CategoryFormState = { status: "idle" };

function CategoryRow({ category }: { category: Category }) {
  return (
    <li className="flex items-center gap-2 rounded-lg border border-neutral-200 p-3">
      <form action={updateCategoryAction} className="flex flex-1 items-center gap-2">
        <input type="hidden" name="id" value={category.id} />
        <input
          type="text"
          name="name"
          defaultValue={category.name}
          className="flex-1 rounded-md border border-neutral-300 p-2 text-sm"
        />
        <select
          name="role"
          defaultValue={category.role}
          className="rounded-md border border-neutral-300 p-2 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-full border border-neutral-300 px-3 py-2 text-xs font-medium"
        >
          Save
        </button>
      </form>
      <form action={deleteCategoryAction}>
        <input type="hidden" name="id" value={category.id} />
        <button
          type="submit"
          className="rounded-full px-3 py-2 text-xs font-medium text-red-600"
        >
          Delete
        </button>
      </form>
    </li>
  );
}

export default function CategoriesManager({ categories }: { categories: Category[] }) {
  const [state, formAction, pending] = useActionState(addCategoryAction, initialState);

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col gap-2">
        {categories.map((category) => (
          <CategoryRow key={category.id} category={category} />
        ))}
        {categories.length === 0 && (
          <p className="text-sm text-neutral-500">No categories yet.</p>
        )}
      </ul>

      <form action={formAction} className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3">
        <p className="text-sm font-medium">Add a category</p>
        <div className="flex gap-2">
          <input
            type="text"
            name="name"
            placeholder="Name"
            required
            className="flex-1 rounded-md border border-neutral-300 p-2 text-sm"
          />
          <select
            name="role"
            defaultValue="top"
            className="rounded-md border border-neutral-300 p-2 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {state.status === "error" && (
          <p className="text-sm text-red-700">{state.message}</p>
        )}
      </form>
    </div>
  );
}
