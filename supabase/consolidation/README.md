# One Supabase project for all four apps

This project (`nvdcdghoiqmncregbknm`, formerly just wardrobe) now holds every
app, each in its own Postgres schema:

| App              | Schema     | Old project (to retire)  |
| ---------------- | ---------- | ------------------------ |
| wardrobe         | `public`   | — (this one)             |
| meetings         | `meetings` | `etcehyuywewsukksnhmf`   |
| piano            | `piano`    | `jochehygpypjbrrayxkc`   |
| holiday-schedule | `holiday`  | `kzdhgzeqylzxbfdputih`   |

The tables, policies, functions, buckets and realtime settings are already
created (`supabase/migrations/20261019*`, `20261122*`). Each app's
`claude/youthful-edison-pjaisi` branch points its code at its schema. What's
left is copying the data and switching each app over.

Adding another app later: create a new schema the same way, add it to the
exposed schemas, and pass `db: { schema: '<name>' }` to `createClient`. When
the project gets busy, upgrade its compute size instead of adding projects.

## 1. Dashboard settings (shared project)

1. **Data API → Exposed schemas**: add `meetings`, `piano`, `holiday`
   (keep `public`). Without this the apps get "schema must be one of…" errors.
2. **Authentication → URL Configuration → Redirect URLs**: add the piano and
   holiday-schedule site URLs (with `/**`), next to wardrobe's.
3. **Authentication → Sign In / Providers**: holiday-schedule uses email +
   password as well as Google, so make sure **Email** is enabled and new
   sign-ups are allowed if holiday people should still be able to register.
   Google is already set up for wardrobe; piano and holiday now sign in through
   the same Google client, so its consent screen shows wardrobe's app name.
4. **Authentication → Emails**: if holiday-schedule's old project had a custom
   password-reset template (it uses the 6-digit code) or custom SMTP, copy
   them across.

## 2. Copy the data

Run once, just before switching the apps over (anything written to the old
projects after this is not copied):

1. Pause holiday-schedule's **price-tracker** GitHub Action so it doesn't write
   to the old project mid-copy.
2. From a machine with `pg_dump`/`psql` 17+, set the variables listed at the
   top of `migrate-data.sh` and run:

   ```bash
   bash supabase/consolidation/migrate-data.sh
   ```

   It copies every row, holiday-schedule's logins (same passwords; your account
   is merged with the one already here) and its stored files, rewrites
   stored file links to the new project, then prints a row-count check that
   should read `ok` on every line. It refuses to run over a schema that
   already has rows; `FORCE=1` empties and recopies, so use it only before the
   apps are switched.

## 3. Switch each app

| App              | Merge branch | Then update                                                                                     |
| ---------------- | ------------ | ----------------------------------------------------------------------------------------------- |
| meetings         | yes          | Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`                              |
| piano            | yes          | Vercel: the same two, plus `SUPABASE_SERVICE_ROLE_KEY`                                            |
| holiday-schedule | yes          | Vercel: `SUPABASE_SERVICE_ROLE_KEY`; GitHub repo secret `SUPABASE_SERVICE_ROLE_KEY`; re-enable the price-tracker Action |
| wardrobe         | yes (migrations only, no app change) | nothing                                                            |

URL: `https://nvdcdghoiqmncregbknm.supabase.co`. Keys: Project Settings → API
Keys. holiday-schedule has its URL and publishable key in the code already.

Sign in again on piano and holiday-schedule after switching; old sessions
belong to the old projects.

## 4. Check, then retire the old projects

- meetings: run a presenter session; the screen should follow the remote live.
- piano: edit a song while signed in (writes are now limited to emails in
  `piano.owners`; add more with
  `insert into piano.owners values ('someone@example.com')`).
- holiday-schedule: sign in with a password account and a Google account,
  check the chalkboard images load, and let one price-tracker run finish.

When all four look right, **pause** the three old projects (Project Settings
→ General) and delete them after a week or two. Pausing stops their compute
charges, and that's where the saving comes from.
