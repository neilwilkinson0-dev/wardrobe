import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SuggestClient from "./SuggestClient";

const DEFAULT_OCCASIONS = [
  "normal day",
  "WFH",
  "office",
  "going out",
  "gig/performing",
  "dressy",
];

export default async function SuggestPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: preferences } = await supabase
    .from("preferences")
    .select("occasion_tags")
    .maybeSingle();

  const occasionTags =
    preferences?.occasion_tags && preferences.occasion_tags.length > 0
      ? preferences.occasion_tags
      : DEFAULT_OCCASIONS;

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Today&apos;s suggestion</h1>
        <Link href="/" className="text-sm text-neutral-500 underline underline-offset-2">
          Back to wardrobe
        </Link>
      </div>
      <SuggestClient occasionTags={occasionTags} />
    </div>
  );
}
