import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewItemForm from "./NewItemForm";

// The classification + background-removal work scheduled via after() in
// quickAddItemAction runs within this route's serverless function lifetime.
export const maxDuration = 60;

export default async function NewItemPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-6 text-xl font-semibold">Add an item</h1>
      <NewItemForm userId={user.id} />
    </div>
  );
}
