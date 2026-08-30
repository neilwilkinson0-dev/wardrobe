"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { getSuggestionAction, type SuggestState } from "./actions";
import { saveOutfitAction, type SaveOutfitState } from "@/app/outfits/actions";

const initialState: SuggestState = { status: "idle" };
const initialSaveState: SaveOutfitState = { status: "idle" };

const ROLE_LABEL: Record<string, string> = {
  top: "Top",
  bottom: "Bottom",
  footwear: "Footwear",
  outer_layer: "Outer layer",
};

export default function SuggestClient({ occasionTags }: { occasionTags: string[] }) {
  const [state, formAction, pending] = useActionState(getSuggestionAction, initialState);
  const [saveState, saveFormAction, savePending] = useActionState(saveOutfitAction, initialSaveState);
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "granted" | "denied">(
    "idle",
  );
  const latRef = useRef<HTMLInputElement>(null);
  const lonRef = useRef<HTMLInputElement>(null);

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("denied");
      return;
    }
    setLocationStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (latRef.current) latRef.current.value = position.coords.latitude.toString();
        if (lonRef.current) lonRef.current.value = position.coords.longitude.toString();
        setLocationStatus("granted");
      },
      () => setLocationStatus("denied"),
    );
  }

  const flatlayUrl =
    state.status === "ready"
      ? (() => {
          const params = new URLSearchParams();
          for (const item of state.items) params.set(item.role === "outer_layer" ? "outer" : item.role, item.id);
          return `/api/flatlay?${params.toString()}`;
        })()
      : null;

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-3">
        <input ref={latRef} type="hidden" name="lat" />
        <input ref={lonRef} type="hidden" name="lon" />

        <label className="flex flex-col gap-1 text-sm font-medium">
          Occasion
          <select
            name="occasion"
            defaultValue={occasionTags[0] ?? "normal day"}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          >
            {occasionTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={requestLocation}
          className="self-start text-sm text-neutral-500 underline underline-offset-2"
        >
          {locationStatus === "granted"
            ? "Location set for weather"
            : locationStatus === "requesting"
              ? "Getting location…"
              : locationStatus === "denied"
                ? "Location unavailable — using season only"
                : "Use my location for weather-aware suggestions"}
        </button>

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-black px-6 py-3 text-base font-medium text-white disabled:opacity-50"
        >
          {pending ? "Styling…" : "Get today's suggestion"}
        </button>
      </form>

      {state.status === "error" && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{state.message}</p>
      )}

      {state.status === "ready" && (
        <div className="flex flex-col gap-4">
          {state.notices.length > 0 && (
            <div className="flex flex-col gap-1">
              {state.notices.map((notice, i) => (
                <p key={i} className="rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
                  {notice}
                </p>
              ))}
            </div>
          )}
          {!state.usedWeather && (
            <p className="text-xs text-neutral-500">
              Season-only pick — enable location for weather-aware suggestions.
            </p>
          )}

          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={flatlayUrl!} alt={state.name} className="w-full" />
          </div>

          <div>
            <h2 className="text-lg font-semibold">{state.name}</h2>
            <p className="mt-1 text-sm text-neutral-600">{state.reasoning}</p>
          </div>

          <ul className="flex flex-col gap-1 text-sm">
            {state.items.map((item) => (
              <li key={item.id}>
                <Link href={`/items/${item.id}`} className="underline underline-offset-2">
                  {ROLE_LABEL[item.role] ?? item.role}: {item.subcategory ?? "item"}
                </Link>
              </li>
            ))}
          </ul>

          <form action={saveFormAction}>
            <input type="hidden" name="name" value={state.name} />
            {state.items.map((item) => (
              <input key={item.id} type="hidden" name="itemId" value={item.id} />
            ))}
            {saveState.status === "error" && (
              <p className="mb-2 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
                {saveState.message}
              </p>
            )}
            <button
              type="submit"
              disabled={savePending}
              className="w-full rounded-full border border-black px-6 py-3 text-base font-medium disabled:opacity-50"
            >
              {savePending ? "Saving…" : "Save this outfit"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
