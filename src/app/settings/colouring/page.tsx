import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ColouringForm from "./ColouringForm";

interface StoredColouringProfile {
  undertone?: string | null;
  hair?: string | null;
  eyes?: string | null;
  notes?: string | null;
  flattering_colours?: string[];
  unflattering_colours?: string[];
}

export default async function ColouringPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: preferences } = await supabase
    .from("preferences")
    .select("colouring_profile")
    .maybeSingle();

  const stored = (preferences?.colouring_profile as StoredColouringProfile | null) ?? {};

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Colouring profile</h1>
        <Link href="/settings/preferences" className="text-sm text-neutral-500 underline underline-offset-2">
          Back to preferences
        </Link>
      </div>
      <p className="mb-6 text-sm text-neutral-500">
        A humble steer, not a verdict — suggestions lean gently toward colours that suit you and away
        from ones that don&apos;t, never as a hard rule.
      </p>
      <ColouringForm
        userId={user.id}
        profile={{
          undertone: stored.undertone ?? null,
          hair: stored.hair ?? null,
          eyes: stored.eyes ?? null,
          notes: stored.notes ?? null,
          flattering_colours: stored.flattering_colours ?? [],
          unflattering_colours: stored.unflattering_colours ?? [],
        }}
      />
    </div>
  );
}
