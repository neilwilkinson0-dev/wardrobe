import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WearLog from "@/components/WearLog";
import {
  renameOutfitAction,
  rateOutfitAction,
  logOutfitWearAction,
  deleteOutfitWearEventAction,
} from "../actions";

const ROLE_LABEL: Record<string, string> = {
  top: "Top",
  bottom: "Bottom",
  footwear: "Footwear",
  outer_layer: "Outer layer",
  accessory: "Accessory",
};

export default async function OutfitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: outfit } = await supabase
    .from("outfits")
    .select("*, outfit_items(items(id, subcategory, categories(role)))")
    .eq("id", id)
    .single();

  if (!outfit) notFound();

  const { data: wearEvents } = await supabase
    .from("wear_events")
    .select("id, worn_on")
    .eq("outfit_id", id)
    .order("worn_on", { ascending: false });

  const params2 = new URLSearchParams();
  const memberItems = (outfit.outfit_items ?? [])
    .map((oi) => oi.items)
    .filter((item): item is NonNullable<typeof item> => item !== null);

  for (const item of memberItems) {
    const role = item.categories?.role;
    if (!role) continue;
    const key = role === "outer_layer" ? "outer" : role;
    if (["top", "bottom", "footwear", "outer"].includes(key)) params2.set(key, item.id);
  }
  const flatlayUrl = `/api/flatlay?${params2.toString()}`;

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/outfits" className="text-sm text-neutral-500 underline underline-offset-2">
          All outfits
        </Link>
      </div>

      <div className="mb-4 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={flatlayUrl} alt={outfit.name} className="w-full" />
      </div>

      <form action={renameOutfitAction} className="mb-4 flex gap-2">
        <input type="hidden" name="outfitId" value={outfit.id} />
        <input
          type="text"
          name="name"
          defaultValue={outfit.name}
          className="flex-1 rounded-md border border-neutral-300 p-2 text-sm font-medium"
        />
        <button
          type="submit"
          className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium"
        >
          Rename
        </button>
      </form>

      <form action={rateOutfitAction} className="mb-4 flex items-center gap-1">
        <input type="hidden" name="outfitId" value={outfit.id} />
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="submit"
            name="rating"
            value={star}
            className={`text-2xl ${outfit.rating && star <= outfit.rating ? "text-amber-500" : "text-neutral-300"}`}
            aria-label={`Rate ${star} stars`}
          >
            ★
          </button>
        ))}
      </form>

      <div className="mb-6">
        <WearLog
          hiddenFields={{ outfitId: outfit.id }}
          events={wearEvents ?? []}
          logAction={logOutfitWearAction}
          deleteAction={deleteOutfitWearEventAction}
        />
      </div>

      <ul className="flex flex-col gap-1 text-sm">
        {memberItems.map((item) => (
          <li key={item.id}>
            <Link href={`/items/${item.id}`} className="underline underline-offset-2">
              {ROLE_LABEL[item.categories?.role ?? ""] ?? "Item"}: {item.subcategory ?? "item"}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
