"use client";

import { useActionState, useState } from "react";
import { submitFeedbackAction, type FeedbackState } from "./actions";
import type { Forecast } from "@/lib/weather/getForecast";

const initialState: FeedbackState = { status: "idle" };

const QUICK_REASONS = [
  { value: "too_formal", label: "Too formal" },
  { value: "colours_clash", label: "Colours clash" },
  { value: "wrong_weather", label: "Wrong for weather" },
  { value: "boring", label: "Boring" },
  { value: "not_feeling_it", label: "Not feeling it" },
];

export default function SuggestionFeedback({
  name,
  itemIds,
  occasion,
  weather,
}: {
  name: string;
  itemIds: string[];
  occasion: string;
  weather: Forecast | null;
}) {
  const [state, formAction, pending] = useActionState(submitFeedbackAction, initialState);
  const [thumb, setThumb] = useState<"up" | "down" | null>(null);

  if (state.status === "submitted") {
    return <p className="text-sm text-neutral-500">Thanks — noted.</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4">
      <input type="hidden" name="name" value={name} />
      {itemIds.map((id) => (
        <input key={id} type="hidden" name="itemId" value={id} />
      ))}
      <input type="hidden" name="occasion" value={occasion} />
      <input type="hidden" name="weather" value={weather ? JSON.stringify(weather) : ""} />
      <input type="hidden" name="rating" value={thumb === "up" ? "5" : thumb === "down" ? "1" : ""} />

      <div className="flex items-center gap-3">
        <p className="text-sm font-medium">How was this suggestion?</p>
        <button
          type="button"
          onClick={() => setThumb("up")}
          className={`text-2xl ${thumb === "up" ? "" : "opacity-40"}`}
          aria-label="Good suggestion"
        >
          👍
        </button>
        <button
          type="button"
          onClick={() => setThumb("down")}
          className={`text-2xl ${thumb === "down" ? "" : "opacity-40"}`}
          aria-label="Not a good suggestion"
        >
          👎
        </button>
      </div>

      {thumb === "down" && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {QUICK_REASONS.map((reason) => (
              <label
                key={reason.value}
                className="flex items-center gap-1 rounded-full border border-neutral-300 px-3 py-1 text-xs"
              >
                <input type="checkbox" name="quickReason" value={reason.value} />
                {reason.label}
              </label>
            ))}
          </div>
          <textarea
            name="freeform"
            rows={2}
            placeholder="Anything else? (optional)"
            className="rounded-md border border-neutral-300 p-2 text-sm"
          />
        </div>
      )}

      {state.status === "error" && (
        <p className="text-sm text-red-700">{state.message}</p>
      )}

      <button
        type="submit"
        disabled={!thumb || pending}
        className="self-start rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium disabled:opacity-40"
      >
        {pending ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
