# Wardrobe

A private, per-user wardrobe app: photograph what you own, log what you wear, and get
outfit suggestions that make use of clothes you already have. See `docs/wardrobe-spec.md`
for the full product spec and `docs/wardrobe-build-instructions.md` for the build plan.

## Stack

Next.js (App Router, TypeScript) · Supabase (Postgres, Storage, Auth) · Vercel.

## Status

**All 11 v1 build milestones done**, live at `wardrobe.neilpilla.com`:

1. Foundation — Google sign-in, full RLS-locked schema, private storage.
2. Add + view items — photo → async background classification (category, colours,
   pattern, material, etc.) + background-removed cut-out, confidence flags shown per field.
3. User-defined categories with roles (top/bottom/footwear/outer_layer/accessory), seeded
   defaults, full manage UI.
4. Tap-to-log wear events (dated, not a counter) with a wear-history view.
5. Duplicate detection, at add-time and as a whole-wardrobe audit.
6. Suggestions v1 — weather/season/occasion-aware, neglected-biased, real flat-lay boards
   composited server-side from the cut-outs.
7. Save/rename/rate/re-wear outfits, plus snap-and-confirm wear logging from an outfit photo.
8. Feedback loop (thumbs + quick reasons + context) distilled into durable style principles,
   editable preferences screen.
9. Editable colouring profile (self-described, optional tentative photo read) steering
   suggestions as a humble nudge, never a rule.
10. Style engine — describe / gap / stretch / shopping guidance, the last one grounded in
    live web search for current UK shops and prices.
11. Dashboard home view (neglected-item nudge + recently added), full browse/filter/search,
    optional cost-per-wear.

Known gap: RLS is architecturally enforced (every table scoped to `auth.uid()`, verified
clean by the Supabase security advisor) but hasn't yet been manually re-verified end-to-end
with a second real account signed in side-by-side.

## Local setup

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.local.example` to `.env.local` and fill in the values (Supabase project
   settings → API for the URL/keys; see the build-instructions doc for the rest).
3. **Enable Google auth on the Supabase project** (Authentication → Providers → Google):
   create an OAuth client in Google Cloud Console and paste the client ID/secret in,
   using the callback URL Supabase shows on that screen. This step has to be done by hand
   in each dashboard — it can't be scripted from here.
4. Run the dev server:
   ```
   npm run dev
   ```

## Database

Schema and RLS policies live in `supabase/migrations/` and are already applied to the
`wardrobe` Supabase project (eu-west-1). Every table is scoped to `auth.uid()` — a second
account cannot see a first account's rows. Two private storage buckets, `originals` and
`cutouts`, hold garment photos, path-scoped per user.

## Deployment

Live on Vercel at `wardrobe.neilpilla.com`, deployed from this repo. Env vars (Supabase
URL/anon key, `ANTHROPIC_API_KEY`, `REMOVE_BG_API_KEY`, `ALLOWED_EMAILS`) live in the
Vercel project's Environment Variables settings, mirroring `.env.local`.

`ALLOWED_EMAILS` gates sign-in to an explicit allowlist (comma-separated) — Google auth
alone would otherwise let anyone with a Google account sign up.
