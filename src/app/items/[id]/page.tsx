import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PendingRefresher from "@/components/PendingRefresher";
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

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, role")
    .order("name");

  const isPending = item.classification_status === "pending";

  const duplicates = await Promise.all(
    (item.possible_duplicate_ids ?? []).map(async (dupId) => {
      const { data: dup } = await supabase
        .from("items")
        .select("id, subcategory, cutout_path, original_photo_path")
        .eq("id", dupId)
        .single();
      if (!dup) return null;
      const dupBucket = dup.cutout_path ? "cutouts" : "originals";
      const dupPath = dup.cutout_path ?? dup.original_photo_path;
      const { data: dupSigned } = await supabase.storage
        .from(dupBucket)
        .createSignedUrl(dupPath, SIGNED_URL_TTL_SECONDS);
      return { ...dup, thumbnailUrl: dupSigned?.signedUrl ?? null };
    }),
  );
  const validDuplicates = duplicates.filter((d): d is NonNullable<typeof d> => d !== null);

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <PendingRefresher active={isPending} />

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

      {isPending && (
        <p className="mb-4 rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Classifying in the background — this updates automatically once it&apos;s done.
        </p>
      )}

      {item.processing_notices && item.processing_notices.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {item.processing_notices.map((notice, i) => (
            <p key={i} className="rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
              {notice}
            </p>
          ))}
        </div>
      )}

      {validDuplicates.length > 0 && (
        <div className="mb-4 flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900">Already in your wardrobe?</p>
          <div className="flex gap-3 overflow-x-auto">
            {validDuplicates.map((dup) => (
              <Link
                key={dup.id}
                href={`/items/${dup.id}`}
                className="flex w-20 flex-shrink-0 flex-col items-center gap-1 text-center"
              >
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md border border-amber-300 bg-white">
                  {dup.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={dup.thumbnailUrl}
                      alt={dup.subcategory ?? "Similar item"}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-neutral-400">No photo</span>
                  )}
                </div>
                <span className="text-xs text-amber-900">{dup.subcategory ?? "Item"}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

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

      <ItemDetailForm item={item} categories={categories ?? []} />

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
