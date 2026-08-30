import Link from "next/link";

export interface ItemCardData {
  id: string;
  subcategory: string | null;
  categoryName: string | null;
  thumbnailUrl: string | null;
  pending?: boolean;
}

export default function ItemCard({ item }: { item: ItemCardData }) {
  return (
    <Link href={`/items/${item.id}`} className="block overflow-hidden rounded-lg border border-neutral-200">
      <div className="relative flex aspect-square items-center justify-center bg-neutral-50">
        {item.pending && (
          <span className="absolute right-1 top-1 z-10 rounded-full bg-black/70 px-2 py-0.5 text-xs text-white">
            Classifying…
          </span>
        )}
        {item.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnailUrl}
            alt={item.subcategory ?? "Wardrobe item"}
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="text-xs text-neutral-400">No photo</span>
        )}
      </div>
      <div className="p-2 text-sm">
        <p className="font-medium">{item.subcategory ?? "Untitled item"}</p>
        <p className="text-xs text-neutral-500">{item.categoryName ?? "Uncategorised"}</p>
      </div>
    </Link>
  );
}
