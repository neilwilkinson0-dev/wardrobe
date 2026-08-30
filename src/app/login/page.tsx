import { signInWithGoogle } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Wardrobe</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Your clothes, organised and put to work.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
          Sign in failed — please try again.
        </p>
      )}

      <form action={signInWithGoogle}>
        <button
          type="submit"
          className="rounded-full bg-black px-6 py-3 text-base font-medium text-white active:scale-[0.98]"
        >
          Sign in with Google
        </button>
      </form>
    </div>
  );
}
