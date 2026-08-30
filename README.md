# Wardrobe

A private, per-user wardrobe app: photograph what you own, log what you wear, and get
outfit suggestions that make use of clothes you already have. See `docs/wardrobe-spec.md`
for the full product spec and `docs/wardrobe-build-instructions.md` for the build plan.

## Stack

Next.js (App Router, TypeScript) · Supabase (Postgres, Storage, Auth) · Vercel.

## Status

**Milestone 1 (foundation) done:** Google sign-in via Supabase Auth, full schema with
row-level security on every table, private storage buckets, and an empty-but-provably-yours
wardrobe home page.

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

Not yet wired up. Once ready: import this repo into Vercel, copy the env vars from
`.env.local` into Project Settings → Environment Variables, and attach the
`wardrobe.neilpilla.com` domain.
