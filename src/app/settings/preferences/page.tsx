import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PreferencesForm from "./PreferencesForm";

export default async function PreferencesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: preferences } = await supabase
    .from("preferences")
    .select("style_principles, occasion_tags, naming_playfulness")
    .maybeSingle();

  const stylePrinciples = Array.isArray(preferences?.style_principles)
    ? (preferences.style_principles as string[])
    : [];

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Preferences</h1>
        <Link href="/" className="text-sm text-neutral-500 underline underline-offset-2">
          Back to wardrobe
        </Link>
      </div>
      <Link
        href="/settings/colouring"
        className="mb-6 inline-block text-sm text-neutral-500 underline underline-offset-2"
      >
        Edit colouring profile
      </Link>
      <PreferencesForm
        stylePrinciples={stylePrinciples}
        occasionTags={preferences?.occasion_tags ?? []}
        namingPlayfulness={preferences?.naming_playfulness ?? "moderate"}
      />
    </div>
  );
}
