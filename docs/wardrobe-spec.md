# Wardrobe App — Product Specification

**Domain:** `wardrobe.neilpilla.com`
**Owner:** Neil
**Status:** v1 scope agreed; phase 2 items specced and walled off
**Stack:** Next.js (App Router) · Supabase (Postgres, Storage, Auth) · Vercel · GitHub

---

## 1. The problem this solves

Neil owns too many clothes, wears a small subset, and wants to (a) see and organise
everything he owns, (b) stop buying duplicates, (c) get genuinely good daily outfit
ideas that revive neglected pieces, (d) develop his style, and (e) buy new things only
where they fill a real gap. The app's job is to **maximise the wardrobe he already has**
and make him more stylish — not to encourage buying more.

## 2. Guiding principles

These thread through every feature and should be treated as design law, not decoration.

1. **Claude drafts, the user edits.** Classification, duplicate flags, outfit logging,
   colour reads, style verdicts — all are proposed by Claude and confirmed/corrected by
   the user. Nothing is presented as an unchallengeable verdict.
2. **Best guess, easy override.** Wherever the app is uncertain (which of three navy
   crews, which occasion), it leads with its most likely guess and makes swapping to an
   alternative a single tap.
3. **Editable, inspectable, not a black box.** Preferences, style principles, colouring
   profile, categories, occasion tags — all are data the user can read and change, never
   opaque model state.
4. **Bends to the user, doesn't box them in.** Categories and occasion tags are
   user-defined with sensible defaults, growable over time.
5. **Anti-consumerist bias.** The app prefers combinations already owned and filling
   real gaps over new purchases, and actively celebrates wearing neglected clothes.
6. **Useful before complete.** The app must give value from ~a dozen items in, so the
   effort of adding clothes is rewarded early, not only after everything's logged.
7. **Private by default.** Every row is owned by a user and protected by row-level
   security from day one.
8. **Economical.** Don't re-run expensive AI calls needlessly; cache derived assets.

## 3. Users, auth, and architecture

- **Auth:** Supabase Auth, **Google as the sole provider**. No passwords.
- **Multi-user from the ground up.** Every user who logs in gets their own fully private
  wardrobe — own items, outfits, wear history, preferences, colouring profile. There is
  no shared/global data. This is architected now even though Neil is the only initial
  user, because Pilla may later run her own wardrobe.
- **Row-Level Security (RLS) on every table** from day one, keyed on `auth.uid()`.
  Watertight user scoping is a v1 requirement, not a later hardening pass.
- **Cross-wardrobe sharing is explicitly phase 2** (see §12). v1 builds the plumbing that
  makes independent wardrobes possible; it does *not* build any feature for one user to
  view or rate another's wardrobe.

## 4. Data model (conceptual)

Exact columns are in the build-instructions doc; this is the shape and the reasoning.

### Users
Provided by Supabase Auth. Everything below carries a `user_id` FK and is RLS-scoped.

### Categories (user-defined)
- Ships with sensible defaults (e.g. tops, trousers, knitwear, coats, shoes).
- User can add/rename/remove categories at will.
- **Each category carries an outfit *role*** from a small fixed set of slots:
  `top` · `bottom` · `footwear` · `outer_layer` · `accessory`.
  The role is what lets the suggestion engine build a valid outfit (one top, one bottom,
  footwear, optional layer) rather than nonsense. Categories are free; roles are the
  small stable structure the engine needs.

### Items
Each garment. Fields grouped by how they're populated:

**From the garment photo (visual — auto, no typing):**
category · subcategory · dominant colour(s) · secondary colour(s) · pattern · formality
· silhouette/fit · rough season suitability.

**From the optional label photo (factual — auto if provided):**
material composition · care instructions · brand · size.

**User-added, all optional (context Claude can't see):**
price (enables cost-per-wear) · when/where acquired · personal notes.

**System fields:**
`added_date` · original photo path · background-removed cut-out path ·
**per-field confidence flags** (which values came from a label = solid, vs guessed from
the garment = tentative) · retired flag (see §7).

### Wear events
**Dated events, not a counter.** Each wear of an item and/or outfit is a row with a date.
This is what powers "not worn in 6 months," recency reasoning, cost-per-wear, most/least
worn. A bare tally can't answer the questions that actually revive neglected clothes.

### Outfits
A saved combination of items. Fields: the member items · **auto-generated descriptive
name** (Claude-written, e.g. "Navy crew + stone chinos + white trainers"; user can
rename) · optional rating · `saved_date` · `last_worn_date`.

### Preferences / style profile (per user, editable)
- Distilled **style principles** (see §8).
- **Occasion tags** (user-defined, with defaults: WFH, office, going out, gig/performing,
  dressy, normal day…).
- **Colouring profile** (see §9): self-described and/or tentatively photo-assisted;
  carried as a humble steer, editable.
- Optional toggle for how playful auto-naming should be.

### Feedback
Per-suggestion feedback, **stored with its context** (weather + occasion at the time) so
a contextual "no" is never mistaken for a permanent dislike. Structured signal
(rating + quick-tap reasons) plus optional freeform text.

## 5. Adding items (entry flow)

1. **Photograph the garment** (required).
2. **Optionally photograph the label.** Never blocks a save — many items won't have a
   legible label and that's fine.
3. Claude classifies: visual attributes from the garment shot, factual attributes from
   the label shot if present. Material may be a low-confidence *guess* when there's no
   label; the label upgrades it to fact. Care instructions are lowest-priority (wash
   symbols are fussy to read) — capture if clear, skip if not.
4. **Background removal at entry time.** Save both the original (reference / reprocessing)
   and a transparent PNG cut-out (used for all flat-lay composition). Store both paths on
   the item.
5. Draft is shown with confidence flags; user glances, corrects, saves.
6. **Duplicate check runs at add-time** (see §6) — "this looks a lot like something you
   already own — still add it?"

**Batch-friendly:** adding should support doing several items in a session so the initial
load-in isn't one-at-a-time drudgery.

**Background removal implementation:** start with a hosted API (e.g. remove.bg) called at
upload — one HTTP request, excellent on single garments. Note `rembg` (self-hosted, free)
as the fallback if per-image cost ever matters.

## 6. Duplicate detection

Because every item is classified, "duplicate" is a scored question:
same category + same colour family + same pattern + similar formality ⇒ likely duplicate.
Show the two photos side by side to confirm. Runs **at add-time** and as a **whole-wardrobe
audit**. It won't catch subtle weight differences between two black tees, but it will
reliably flag "you own five near-identical navy crews," which is the useful version.

## 7. Wear logging

Two modes, both first-class:

- **Tap to log** — pick the item(s) you wore directly. Fast when you know.
- **Snap-and-confirm** — photograph your outfit; Claude describes what it sees ("navy
  crew, grey chinos, white trainers") and pre-selects its best-guess items from your
  wardrobe. Where ambiguous (you own three navy crews), it shows a "3 similar" marker;
  tap to see the other candidates as thumbnails and pick the right one. Candidates are
  **ranked** by plausibility (most-worn, recently clean/in rotation, not worn yesterday).
  This is *photo-assisted logging*, not unattended auto-logging.

Every wear writes a **dated event**. Re-wearing a saved outfit is one tap.

**Edit & retire, don't delete:** items can be edited; retiring removes an item from
suggestions **while keeping its wear history intact** so stats stay honest. Avoid hard
deletes that lose the data making the app smart.

## 8. Daily outfit suggestions

**Context the app derives itself:** today's date → season; user location → forecast
(temperature, rain, wind). Suggestions never put Neil in linen at 6°C or suede in rain.

**Context the user supplies:** occasion — one tap from the editable tag set (or "normal
day").

**The engine:** filters to items appropriate for weather + season + occasion, then
composes an outfit respecting category roles (one top, one bottom, footwear, optional
layer), applying **colour-combination theory** (complementary/analogous/tonal, balancing
bold against quiet) and the user's **style principles** and **colouring profile**.
Crucially it **biases toward valid outfits that use neglected clothes** — solving the
"small subset" problem rather than just looking clever.

**Output:** a **flat-lay board** built from the real garment cut-outs (top over bottom
over shoes, optional layer). This is the deliberate sweet spot — it looks like an outfit,
uses real clothes, and is robust to build. (Photorealistic "on-body" try-on is
out — see §12.)

**Feedback loop (spine-level):**
- Every suggestion is rate-able: thumbs/stars + quick-tap reasons ("too formal," "colours
  clash," "wrong for weather," "boring," "not feeling it") + optional freeform.
- Feedback is stored **with weather + occasion context**.
- **Periodic distilling:** Claude turns accumulated feedback into a short set of durable
  **style principles** that ride along with every future suggestion.
- An **editable preferences screen** shows what the app thinks Neil likes; he can correct
  it directly.

## 9. Colour & colouring

Two distinct things, held with different confidence:

- **Colour-combination theory (robust):** which colours work *together*. Real, well-defined,
  reliably applied by Claude over the wardrobe's actual colours. Built into outfit logic
  with no caveats.
- **Colouring profile — what suits *you* (a humble steer):** the "seasonal colour
  analysis" world (undertone, hair, eyes). Useful as a heuristic but the input is exactly
  what a photo reads *unreliably* (lighting/white-balance skew undertone). So it is a
  **user-owned editable profile, not an auto-verdict**, populated by:
  - self-description ("pale, cool undertone, dark hair, blue eyes"; "camel washes me
    out"), and/or
  - optionally a couple of *good natural-light* photos for a **tentative** Claude read,
    explicitly framed as a starting guess to confirm/overrule.

  Once set, it rides along with suggestions ("…and these tend to suit you") and steers
  gently away from colours flagged as unflattering. It also informs shopping ("a
  cool-toned olive rather than a warm khaki, given your colouring"). Carried with humility
  — a well-informed steer, never law.

## 10. Style development & shopping guidance

Four layers, anchored to the wardrobe actually owned:

1. **Describe current style** — Claude articulates what Neil's style *is* ("casual-smart,
   earthy, muted, lots of navy and stone, minimal pattern, no logos"). Valuable because
   most people can't describe their own style; becomes the reference point for everything
   else.
2. **Gap analysis** — compares that picture against what a versatile wardrobe in his style
   would have, and finds the holes ("loads of tops, one pair of shoes that works
   smart-casual"; "nothing mid-weight for spring"). The single most useful new-clothes
   feature — specific, justified, and it maximises outfits per purchase.
3. **Style stretch** — proposes adjacent directions, each naming **what it unlocks with
   clothes already owned** ("an olive overshirt would work over these four shirts and both
   chinos"). Anchored stretch, never untethered trend-chasing.
4. **Shopping guidance** — suggests the **type** of piece + the right **UK shops** for it
   in his style/budget + a **search term** ("mid-weight olive overshirt, cotton,
   unstructured; Uniqlo/COS/Arket, ~£40–70; search 'overshirt'"). **Grounded in live web
   search** at suggestion time so shop ranges are current, not from training memory.

All of this reads the same preferences, feedback and colouring data, so shopping
suggestions automatically respect "no logos / earthy tones / cool-toned." Features
reinforce each other rather than sitting in silos.

*Live in-stock product links and try-on of prospective purchases are phase 2 (see §12).*

## 11. Wardrobe management & dashboard

- **Browse / filter / search:** "all knitwear," "everything navy," "not worn in 3 months."
  How the app becomes a tool worth opening.
- **Neglected-item surfacing:** "never worn," "not worn in 6 months" — falls out of dated
  wear-events; feeds the dashboard and the suggestion bias.
- **Optional cost-per-wear:** one optional price field per item unlocks a motivating stat
  ("those boots are down to 80p a wear").
- **Dashboard / home view:** today's suggestion · "you've not worn these 5 things" · a
  gentle nudge. Turns the app from something consulted into something that quietly works
  on the rut.

## 12. Phase 2 (specced, walled off — do NOT build in v1)

- **Cross-wardrobe sharing** — one user viewing/rating another's wardrobe; combined views.
  (v1 builds the multi-user plumbing; not the sharing features.)
- **Accessories in flat-lays** — scarves/hats/etc drawn *into* the composed board (they
  can already be logged as categories; this is about rendering them in the collage).
- **Structured donate/declutter flow** — a considered "here are 10 to consider parting
  with" with reasoning and a removal workflow.
- **Packing capsules** — "4 days, warm, one dressy evening" → a compact capsule that mixes
  into enough looks. St Lucia trip is the first real test.
- **Literal live-product links** + **try-on of prospective purchases** — retail feeds /
  affiliate APIs; photorealistic on-body rendering.
- **Data export** — get the wardrobe out as data.

### Explicitly cut (not even phase 2 unless re-raised)
- **Laundry / availability tracking** — no dirty/clean state, no availability filtering.
  The app may suggest something that's in the wash; accepted trade for minimal logging
  burden.
- **Photorealistic on-body virtual try-on** of Neil wearing his own clothes — flat-lay
  boards are the chosen approach; on-body rendering is fragile and out of stack.
- Small accessories beyond what the user chooses to add as categories (jewellery, watches,
  bags, belts) — no bespoke handling; they're just categories if the user makes them.

## 13. Cost & privacy notes for the build

- Classification, suggestions and outfit-matching are API calls; background removal may be
  paid per image. At single-user scale this is small, but build sanely: **don't
  re-classify on every edit, cache cut-outs, batch where possible.**
- Photos are personal data (clothes, sometimes the user). **Private storage tied to the
  account from day one** (Supabase Storage with RLS-aligned access), not retrofitted.
