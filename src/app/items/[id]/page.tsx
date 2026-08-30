import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ItemDetailForm from "./ItemDetailForm";
import { toggleRetiredAction, logWearAction } from "./actions";

const SIGNED_URL_TTL_SECONDS = 300;

export default async function ItemDetailPage({
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

  const { data: item } = await supabase
    .from("items")
    .select("*, categories(id, name, role)")
    .eq("id", id)
    .single();

  if (!item) notFound();

  const bucket = item.cutout_path ? "cutouts" : "originals";
  const path = item.cutout_path ?? item.original_photo_path;
  const { data: signed } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  const { data: wearEvents } = await supabase
    .from("wear_events")
    .select("worn_on")
    .eq("item_id", id)
    .order("worn_on", { ascending: false });

  const lastWorn = wearEvents?.[0]?.worn_on ?? null;
  const wearCount = wearEvents?.length ?? 0;

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-4 flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-neutral-50">
        {signed?.signedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={signed.signedUrl}
            alt={item.subcategory ?? "Wardrobe item"}
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="text-xs text-neutral-400">No photo</span>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {item.subcategory ?? "Untitled item"}
          </h1>
          <p className="text-sm text-neutral-500">
            {item.categories?.name ?? "Uncategorised"}
            {item.retired ? " · retired" : ""}
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-neutral-200 p-4">
        <p className="mb-3 text-sm text-neutral-600">
          {wearCount === 0
            ? "Never logged as worn."
            : `Worn ${wearCount} time${wearCount === 1 ? "" : "s"}${
                lastWorn ? ` · last on ${lastWorn}` : ""
              }`}
        </p>
        <form action={logWearAction} className="flex gap-2">
          <input type="hidden" name="itemId" value={item.id} />
          <input
            type="date"
            name="wornOn"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="flex-1 rounded-md border border-neutral-300 p-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Log a wear
          </button>
        </form>
      </div>

      <ItemDetailForm item={item} />

      <form action={toggleRetiredAction} className="mt-6">
        <input type="hidden" name="itemId" value={item.id} />
        <input type="hidden" name="retired" value={(!item.retired).toString()} />
        <button
          type="submit"
          className="w-full rounded-full border border-neutral-300 px-6 py-3 text-sm font-medium text-neutral-700"
        >
          {item.retired ? "Un-retire this item" : "Retire this item"}
        </button>
      </form>
    </div>
  );
}
