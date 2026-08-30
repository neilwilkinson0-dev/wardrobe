# Wardrobe App — Build Instructions for Claude Code

This document is written to be handed to **Claude Code**. It assumes the companion
`wardrobe-spec.md` is the source of truth for *what* and *why*; this document covers
*how* — stack, schema, sequencing, and the specific things to get right.

**Read the spec first.** Where this document and the spec disagree, the spec wins on
intent; ask Neil rather than guessing.

---

## Setup checklist (for Neil, before Claude Code starts)

> This section is for **Neil**, not Claude Code — it's the account and credential setup
> to do (or have done) before/alongside the build. It's also the thing to come back to
> mid-setup: "remind me where the Google OAuth bit goes" → it's here. Each item notes what
> you end up with (usually a key or URL) that Claude Code will need in an env var.
>
> You don't have to do all of this before starting — GitHub + Supabase + Anthropic get you
> through the first milestones; remove.bg and weather can wait until their features are
> built; Vercel + domain matter once you want it live on your phone. Order below is roughly
> the order you'll need them.

### 1. GitHub — the repo
- Create a new **private** repo (e.g. `wardrobe`).
- This is where the code lives and what Vercel deploys from. Claude Code can initialise and
  push to it, or you create it empty and let it push. Either way you need the repo to exist
  and to be signed in to GitHub locally (or have a token) so pushes work.
- **You end up with:** the repo URL.

### 2. Supabase — database, storage, auth
- Create a Supabase account and a **new project**. Pick a region close to the UK
  (London/`eu-west`) so it's snappy.
- From **Project Settings → API**, grab:
  - the **Project URL**,
  - the **anon/publishable key** (safe for the browser),
  - the **service-role key** (server-only — never expose to the client).
- **Google auth:** under **Authentication → Providers → Google**, you enable Google and
  paste in a Google OAuth **client ID + secret**. To get those you go to the **Google Cloud
  Console** → create a project → **APIs & Services → Credentials → Create OAuth client ID**
  (type: Web application), and set the **authorised redirect URI** to the callback URL
  Supabase shows you on that same Google provider screen. (This is the fiddliest step; if
  you get stuck, come back here and we'll walk it slowly.)
- **Storage:** two private buckets (or prefixes), `originals` and `cutouts` — Claude Code
  can create these, but you'll confirm they're **private**, not public.
- **You end up with:** Project URL, anon key, service-role key, and working Google login.

### 3. Anthropic — the AI
- Create an **Anthropic API key** at the Anthropic console (console.anthropic.com), under
  API keys. Put a little credit on the account.
- This powers classification, suggestions, auto-naming, feedback distilling, and the
  style/shopping reasoning (with web search).
- **You end up with:** the Anthropic API key. Server-side only — never ship it to the
  browser.

### 4. Background removal — remove.bg (can wait until the add-item feature)
- Create a **remove.bg** account and get an **API key** (free tier to start, paid per image
  beyond that).
- Called once per item at upload to produce the transparent cut-out. `rembg` (self-hosted,
  free) is the fallback noted in the spec if per-image cost ever bites.
- **You end up with:** the remove.bg API key.

### 5. Weather — a forecast API (can wait until suggestions)
- Pick a forecast provider (e.g. Open-Meteo — no key needed and fine for this; or
  OpenWeatherMap — free tier, needs a key). Open-Meteo is the low-friction choice.
- Used to derive temperature/rain/wind for weather-aware suggestions, from the user's
  location (with permission).
- **You end up with:** an API key if the provider needs one (Open-Meteo doesn't).

### 6. Vercel — hosting + the domain (matters once you want it live)
- Create a **Vercel account** and **import the GitHub repo** as a project. Vercel
  auto-deploys on every push to the main branch.
- Add all the env vars from the steps above in **Project Settings → Environment Variables**
  (Supabase URL + keys, Anthropic key, remove.bg key, weather key). Same names Claude Code
  uses in the code.
- **Domain:** add `wardrobe.neilpilla.com` under the project's **Domains**. Since you
  already run `neilpilla.com` subdomains on Vercel, this is the same pattern — add the
  subdomain and Vercel tells you the DNS record to set (a CNAME) wherever `neilpilla.com`'s
  DNS is managed.
- **You end up with:** the app live at `wardrobe.neilpilla.com`.

### Env vars summary (what Claude Code will expect)
Roughly these — Claude Code confirms exact names in code, but line them up:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server only
ANTHROPIC_API_KEY=                # server only
REMOVE_BG_API_KEY=                # server only
WEATHER_API_KEY=                  # only if provider needs one
```
Keep everything except the `NEXT_PUBLIC_` ones server-side. Put them in a local
`.env.local` for development **and** in Vercel's env settings for production.

### The rough order of operations
1. GitHub repo exists.
2. Supabase project + Google auth working.
3. Anthropic key in hand.
4. Point Claude Code at both docs; build milestones 1–2 (login + add/view items) locally.
5. Add remove.bg when the add-item cut-out step needs it.
6. Add weather when suggestions arrive.
7. Import to Vercel, set env vars, attach the domain — live on your phone.

---

## 0. Stack & conventions

- **Framework:** Next.js (App Router, TypeScript), mobile-first.
- **Backend:** Supabase — Postgres, Storage, Auth (Google provider only), RLS everywhere.
- **Hosting:** Vercel, custom domain `wardrobe.neilpilla.com`.
- **Source:** GitHub repo.
- **AI:** Anthropic API for classification, outfit-description, style reasoning, feedback
  distilling; use vision for the garment/label photos. Web search tool for shopping
  guidance grounding.
- **Background removal:** hosted API (remove.bg or equivalent) at upload; `rembg` noted as
  self-hosted fallback.
- **Weather:** a forecast API keyed by the user's location (with permission).

**Mobile-first is a hard requirement.** Almost all use is on a phone at the wardrobe:
photographing clothes, snapping outfits, tapping for a suggestion. Big tap targets,
camera-friendly flows, fast.

**Cost discipline (build it in, don't bolt on):** never re-classify an item on a plain
edit; cache cut-outs; batch AI calls where the UX allows; store AI outputs so screens
don't re-request them on every render.

---

## 1. Build sequence (do it in this order)

The app must be **useful from ~a dozen items in**, so sequence toward a working core fast,
then layer intelligence. Suggested milestones:

1. **Foundation:** repo, Next.js skeleton, Supabase project, Google auth, domain, RLS
   baseline. A logged-in user sees an empty wardrobe that is provably *theirs*.
2. **Add + view items:** garment photo → storage → classification draft → confirm → save;
   background cut-out saved alongside. Grid view of items. This alone is usable.
3. **Categories & roles:** user-defined categories with defaults and the fixed role set.
4. **Wear logging (tap mode) + dated wear-events.** Neglected-item surfacing falls out
   cheaply once this exists.
5. **Duplicate detection** (add-time + audit).
6. **Suggestions v1:** weather/season/occasion-aware, role-valid, neglected-biased, output
   as **flat-lay boards** from cut-outs.
7. **Save outfits** (auto-named), **snap-and-confirm wear logging.**
8. **Feedback loop + editable preferences + distilling.**
9. **Colouring profile + colour-combination logic.**
10. **Style engine** (describe / gap / stretch / shopping with web search).
11. **Dashboard**, browse/filter/search, edit & retire, optional cost-per-wear polish.

Do **not** start any phase-2 item (see spec §12). Laundry tracking is cut entirely.

---

## 2. Database schema (Postgres / Supabase)

All tables have `id uuid pk default gen_random_uuid()`, `user_id uuid not null references
auth.users`, `created_at timestamptz default now()`. **RLS policy on every table:
`user_id = auth.uid()` for select/insert/update/delete.** No table is exempt.

### `categories`
- `name text not null`
- `role text not null check (role in ('top','bottom','footwear','outer_layer','accessory'))`
- `is_default boolean default false`
- Unique on `(user_id, name)`.
- Seed a default set per new user (tops, trousers, knitwear, coats, shoes) via a trigger
  or first-login routine.

### `items`
- `category_id uuid references categories`
- Visual (auto from garment photo): `subcategory text`, `colours jsonb` (dominant +
  secondary), `pattern text`, `formality text`, `silhouette text`, `season_suitability text`
- Factual (auto from label photo if present): `material text`, `care text`, `brand text`,
  `size text`
- User-optional: `price numeric`, `acquired_note text`, `notes text`
- Assets: `original_photo_path text not null`, `cutout_path text`
- `confidence jsonb` — per-field confidence flags (which values are label-sourced/solid vs
  garment-guessed/tentative)
- `added_date date not null default current_date`
- `retired boolean default false` — retire ≠ delete; keeps wear history, drops from
  suggestions

### `wear_events`
- `item_id uuid references items` (nullable if logging an outfit as a whole)
- `outfit_id uuid references outfits` (nullable)
- `worn_on date not null`
- `weather jsonb` (snapshot at log time — optional but useful)
- `occasion text` (optional)
- **This is an events table, never a counter.** All "not worn in N months," recency,
  cost-per-wear, most/least-worn derive from here.

### `outfits`
- `item_ids uuid[]` (or a join table `outfit_items` — prefer the join table)
- `name text` — **auto-generated descriptive name**, user-renamable
- `rating int` (nullable)
- `saved_date date default current_date`
- `last_worn_date date` (nullable; updated from wear_events)
- `source text` — e.g. 'suggested' | 'manual'

### `preferences` (one row per user)
- `style_principles jsonb` — distilled durable principles
- `occasion_tags text[]` — user-defined with defaults
- `colouring_profile jsonb` — undertone/hair/eyes/notes + flattering/unflattering colours;
  editable; carried as a humble steer
- `naming_playfulness text` — how characterful auto-names should be

### `feedback`
- `suggestion_ref` — link/embedding of the suggested outfit
- `rating int`
- `quick_reasons text[]` — e.g. too_formal, colours_clash, wrong_weather, boring
- `freeform text`
- `context jsonb` — **weather + occasion at the time** (critical: prevents a contextual
  "no" becoming a permanent dislike)

> Migrations: use Supabase migrations, checked into the repo. Keep RLS policies in the
> migration files so they're versioned, not clicked in by hand.

---

## 3. Storage

- Two buckets (or prefixed paths): **originals** and **cutouts**. Both **private**;
  access scoped so a user can only read their own paths (align with RLS / signed URLs).
- On add: upload original → call background-removal API → upload the returned transparent
  PNG as the cut-out → store both paths on the item.
- Cut-outs are the assets used for all flat-lay composition; never recompute them on the
  fly.

---

## 4. AI integration specifics

### Classification (vision)
- Input: garment photo (required) + label photo (optional).
- Output a structured draft (JSON) for all visual fields, plus factual fields if a label
  is present. **Set confidence per field** — label-sourced = solid; garment-guessed
  (e.g. material with no label) = tentative.
- Return JSON only (no prose, no markdown fences); parse safely.
- **Do not re-run on a plain edit.** Only re-classify if the user explicitly asks or
  replaces a photo.

### Duplicate scoring
- Can be largely rule-based over classified fields (category + colour family + pattern +
  formality), optionally with an AI tie-break. Show photos side by side to confirm.

### Snap-and-confirm wear logging (vision)
- Describe garments seen in the outfit photo, then match to the user's items. Where
  multiple candidates fit, **rank** them (most-worn, in rotation, not worn yesterday) and
  return the top guess pre-selected with alternatives available.

### Outfit auto-naming
- Short, descriptive, human ("Navy crew + stone chinos + white trainers"), respecting the
  `naming_playfulness` preference. User can rename.

### Suggestion engine
- Assemble context: wardrobe items (role-tagged), derived weather+season, chosen occasion,
  style_principles, colouring_profile, and a **neglected-items list**.
- Produce a role-valid outfit that satisfies weather/occasion, applies colour-combination
  theory + colouring steer, and **prefers outfits using neglected items**.
- Render as a flat-lay from cut-outs (background-removed PNGs layered by role).

### Feedback distilling
- Periodically (e.g. on a threshold of new feedback), hand recent feedback **with its
  context** to Claude: "summarise what you've learned about this user into concise,
  durable style principles." Write the result to `preferences.style_principles`.

### Style engine + shopping
- Describe-style / gap / stretch are reasoning over the wardrobe. Every stretch/shopping
  suggestion must **name what it unlocks with items already owned.**
- Shopping guidance uses the **web search tool** to ground UK shop ranges/prices in
  current data. Output = item type + UK shops + search term (+ rough price). **No live
  product links in v1.**

---

## 5. Flat-lay composition

- Layer cut-out PNGs by role: bottom layer = trousers/bottom, above = top, footwear placed
  below, optional outer layer offset. Keep it a clean styled collage, not a physics sim.
- v1 handles core garments + shoes + optional outer layer. **Scarves/other accessories
  drawn into the board are phase 2** — they can be *logged* now but need not appear in the
  collage.

---

## 6. Auth, security, privacy (get right on day one)

- Supabase Auth, **Google provider only**.
- **RLS on every table**, `user_id = auth.uid()`. Verify with a second test account that
  no cross-user read is possible before building features on top.
- Private storage; serve images via signed URLs or an authenticated route, never public
  buckets.
- Every query is user-scoped. Multi-user correctness is a v1 requirement even though only
  Neil uses it initially — this is the cheap-now/brutal-later foundation for Pilla's
  future wardrobe.

---

## 7. Deployment

- Vercel project linked to the GitHub repo; env vars for Supabase, Anthropic, background
  removal, weather.
- Custom domain `wardrobe.neilpilla.com` (matches Neil's existing subdomain pattern).
- Supabase migrations run as part of the deploy/checked into the repo.

---

## 8. Definition of done for v1

- [ ] Google login; a user's data is provably isolated (verified with two accounts).
- [ ] Add item by garment photo (+ optional label), auto-classified with confidence flags,
      confirm & save; cut-out generated and stored.
- [ ] User-defined categories with roles; sensible defaults seeded.
- [ ] Duplicate detection at add-time and as an audit.
- [ ] Tap and snap-and-confirm wear logging; dated wear-events.
- [ ] Weather/season/occasion-aware suggestions, neglected-biased, as flat-lay boards.
- [ ] Save outfits (auto-named), rename, rate, one-tap re-wear.
- [ ] Feedback with context; editable preferences; periodic distilling into principles.
- [ ] Editable colouring profile; colour-combination logic in suggestions.
- [ ] Style engine: describe / gap / stretch / shopping (web-search-grounded).
- [ ] Neglected surfacing + optional cost-per-wear.
- [ ] Browse/filter/search; edit & retire (not delete).
- [ ] Dashboard home view.
- [ ] RLS + private storage verified; AI calls cost-disciplined.
- [ ] No phase-2 features built; laundry tracking absent by design.
