import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function OutfitsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: outfits } = await supabase
    .from("outfits")
    .select("id, name, rating, last_worn_date, saved_date, outfit_items(items(id, categories(role)))")
    .order("saved_date", { ascending: false });

  const outfitsWithFlatlay = (outfits ?? []).map((outfit) => {
    const params = new URLSearchParams();
    for (const oi of outfit.outfit_items ?? []) {
      const role = oi.items?.categories?.role;
      const itemId = oi.items?.id;
      if (!role || !itemId) continue;
      const key = role === "outer_layer" ? "outer" : role;
      if (["top", "bottom", "footwear", "outer"].includes(key)) params.set(key, itemId);
    }
    return { ...outfit, flatlayUrl: `/api/flatlay?${params.toString()}` };
  });

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Outfits</h1>
        <Link href="/" className="text-sm text-neutral-500 underline underline-offset-2">
          Back to wardrobe
        </Link>
      </div>

      {outfitsWithFlatlay.length === 0 && (
        <p className="text-sm text-neutral-500">
          No saved outfits yet — save one from a{" "}
          <Link href="/suggest" className="underline underline-offset-2">
            suggestion
          </Link>
          .
        </p>
      )}

      <ul className="grid grid-cols-2 gap-3">
        {outfitsWithFlatlay.map((outfit) => (
          <li key={outfit.id} className="overflow-hidden rounded-lg border border-neutral-200">
            <Link href={`/outfits/${outfit.id}`}>
              <div className="flex aspect-square items-center justify-center bg-neutral-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={outfit.flatlayUrl} alt={outfit.name} className="h-full w-full object-contain" />
              </div>
              <div className="p-2 text-sm">
                <p className="font-medium">{outfit.name}</p>
                <p className="text-xs text-neutral-500">
                  {outfit.last_worn_date ? `Last worn ${outfit.last_worn_date}` : "Not worn yet"}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
