"use client";

import { useMemo, useState } from "react";
import ItemCard from "@/components/ItemCard";

export interface BrowseItem {
  id: string;
  subcategory: string | null;
  categoryName: string | null;
  colours: string[];
  thumbnailUrl: string | null;
  pending: boolean;
  retired: boolean;
  daysSinceWorn: number; // Infinity if never worn
}

const NOT_WORN_OPTIONS = [
  { value: "any", label: "Any", days: 0 },
  { value: "3m", label: "Not worn in 3+ months", days: 90 },
  { value: "6m", label: "Not worn in 6+ months", days: 180 },
  { value: "never", label: "Never worn", days: Infinity },
];

export default function BrowseClient({
  items,
  categoryNames,
}: {
  items: BrowseItem[];
  categoryNames: string[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [notWorn, setNotWorn] = useState("any");
  const [showRetired, setShowRetired] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const notWornOption = NOT_WORN_OPTIONS.find((o) => o.value === notWorn);

    return items.filter((item) => {
      if (!showRetired && item.retired) return false;
      if (category !== "all" && item.categoryName !== category) return false;
      if (notWornOption && notWornOption.days > 0 && item.daysSinceWorn < notWornOption.days) {
        return false;
      }
      if (q) {
        const haystack = [item.subcategory ?? "", item.categoryName ?? "", ...item.colours]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [items, query, category, notWorn, showRetired]);

  return (
    <div className="flex flex-col gap-4">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search — e.g. navy, knitwear, chinos"
        className="rounded-md border border-neutral-300 p-2 text-sm"
      />

      <div className="flex flex-wrap gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-neutral-300 p-2 text-sm"
        >
          <option value="all">All categories</option>
          {categoryNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <select
          value={notWorn}
          onChange={(e) => setNotWorn(e.target.value)}
          className="rounded-md border border-neutral-300 p-2 text-sm"
        >
          {NOT_WORN_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} />
          Include retired
        </label>
      </div>

      <p className="text-xs text-neutral-500">
        {filtered.length} item{filtered.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <p className="text-sm text-neutral-500">Nothing matches those filters.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {filtered.map((item) => (
            <li key={item.id}>
              <ItemCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
