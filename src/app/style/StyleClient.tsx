"use client";

import { useActionState } from "react";
import {
  analyzeStyleAction,
  getShoppingGuidanceAction,
  type StyleState,
  type ShoppingState,
} from "./actions";

const initialStyleState: StyleState = { status: "idle" };
const initialShoppingState: ShoppingState = { status: "idle" };

export default function StyleClient() {
  const [styleState, analyzeFormAction, analyzePending] = useActionState(
    analyzeStyleAction,
    initialStyleState,
  );
  const [shoppingState, shoppingFormAction, shoppingPending] = useActionState(
    getShoppingGuidanceAction,
    initialShoppingState,
  );

  return (
    <div className="flex flex-col gap-6">
      <form action={analyzeFormAction}>
        <button
          type="submit"
          disabled={analyzePending}
          className="rounded-full bg-black px-6 py-3 text-base font-medium text-white disabled:opacity-50"
        >
          {analyzePending ? "Analysing…" : "Analyse my style"}
        </button>
      </form>

      {styleState.status === "error" && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{styleState.message}</p>
      )}

      {styleState.status === "ready" && (
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="mb-1 text-lg font-semibold">Your style</h2>
            <p className="text-sm text-neutral-700">{styleState.description}</p>
          </section>

          {styleState.gaps.length > 0 && (
            <section>
              <h2 className="mb-2 text-lg font-semibold">Gaps</h2>
              <ul className="flex flex-col gap-2">
                {styleState.gaps.map((gap, i) => (
                  <li key={i} className="rounded-lg border border-neutral-200 p-3 text-sm">
                    <p className="font-medium">{gap.gap}</p>
                    <p className="text-neutral-600">{gap.reasoning}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {styleState.stretches.length > 0 && (
            <section>
              <h2 className="mb-2 text-lg font-semibold">Style stretch</h2>
              <ul className="flex flex-col gap-2">
                {styleState.stretches.map((stretch, i) => (
                  <li key={i} className="rounded-lg border border-neutral-200 p-3 text-sm">
                    <p className="font-medium">{stretch.direction}</p>
                    <p className="text-neutral-600">Unlocks: {stretch.unlocks}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <form action={shoppingFormAction}>
            <input type="hidden" name="description" value={styleState.description} />
            <input type="hidden" name="gaps" value={JSON.stringify(styleState.gaps)} />
            <input type="hidden" name="stretches" value={JSON.stringify(styleState.stretches)} />
            <button
              type="submit"
              disabled={shoppingPending}
              className="w-full rounded-full border border-black px-6 py-3 text-base font-medium disabled:opacity-50"
            >
              {shoppingPending ? "Searching UK shops…" : "Get shopping guidance"}
            </button>
          </form>

          {shoppingState.status === "error" && (
            <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
              {shoppingState.message}
            </p>
          )}

          {shoppingState.status === "ready" && (
            <section>
              <h2 className="mb-2 text-lg font-semibold">Shopping guidance</h2>
              <ul className="flex flex-col gap-3">
                {shoppingState.suggestions.map((suggestion, i) => (
                  <li key={i} className="rounded-lg border border-neutral-200 p-3 text-sm">
                    <p className="font-medium">
                      {suggestion.item_type}
                      <span className="ml-2 font-normal text-neutral-500">{suggestion.price_range}</span>
                    </p>
                    <p className="text-neutral-600">{suggestion.shops.join(", ")}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      Search: &ldquo;{suggestion.search_term}&rdquo;
                    </p>
                    <p className="mt-1 text-neutral-600">Unlocks: {suggestion.unlocks}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
