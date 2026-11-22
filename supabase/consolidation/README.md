# One Supabase project for all four apps

This project (`nvdcdghoiqmncregbknm`, formerly just wardrobe) now holds every
app, each in its own Postgres schema:

| App              | Schema     | Old project (to retire)  |
| ---------------- | ---------- | ------------------------ |
| wardrobe         | `public`   | — (this one)             |
| meetings         | `meetings` | `etcehyuywewsukksnhmf`   |
| piano            | `piano`    | `jochehygpypjbrrayxkc`   |
| holiday-schedule | `holiday`  | `kzdhgzeqylzxbfdputih`   |

The tables, policies, functions, buckets and realtime settings already exist
(`supabase/migrations/20261019*`, `20261122*`). Each app's
`claude/youthful-edison-pjaisi` branch points its code at its schema.

Move the apps one at a time, easiest first, and pause each old project as
soon as its app works here. Paused projects aren't charged for compute.

Adding another app later: create a new schema the same way, add it to the
exposed schemas, and pass `db: { schema: '<name>' }` to `createClient`. When
the project gets busy, upgrade its compute size instead of adding projects.

## 0. Once

1. Merge wardrobe's `claude/youthful-edison-pjaisi` branch (migrations, this
   script and this file; no app changes).
2. Shared project → Project Settings → Data API → Exposed schemas: add
   `meetings`, `piano` and `holiday` (keep `public`).
3. On the computer you'll run the script from: `pg_dump`/`psql` 17+
   (`brew install postgresql@17` on a Mac), plus `curl` and `python3`.
4. Shared project → Connect → Session pooler: copy the connection string and
   put your database password in it, then:

   ```bash
   export TARGET_DB_URL='postgresql://postgres.nvdcdghoiqmncregbknm:PASSWORD@...pooler.supabase.com:5432/postgres'
   ```

## 1. meetings

1. Old meetings project → Connect → Session pooler →
   `export SOURCE_DB_URL='...'`
2. `bash supabase/consolidation/migrate-data.sh meetings` (it should end
   with "every table matches").
3. Vercel (meetings) → Environment Variables: set `NEXT_PUBLIC_SUPABASE_URL`
   to `https://nvdcdghoiqmncregbknm.supabase.co` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the shared project's publishable key
   (Project Settings → API Keys).
4. Merge the meetings branch (Vercel redeploys with the new values).
5. Check: open a presenter session; the screen should follow the remote live.
6. Pause the old meetings project (its Project Settings → General).

## 2. piano

1. Shared project → Authentication → URL Configuration → Redirect URLs: add
   the piano site URL with `/**` on the end.
2. `export SOURCE_DB_URL='...'` with the old piano project's connection
   string, then `bash supabase/consolidation/migrate-data.sh piano`.
3. Vercel (piano): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   and `SUPABASE_SERVICE_ROLE_KEY` (the shared project's service role / secret
   key).
4. Merge the piano branch.
5. Check: sign in again with Google and edit a song. Only emails in
   `piano.owners` can change data; add more with
   `insert into piano.owners values ('someone@example.com')`.
6. Pause the old piano project.

## 3. holiday-schedule

1. Shared project → Authentication:
   - URL Configuration → Redirect URLs: add the holiday site URL with `/**`.
   - Sign In / Providers → Email: enabled, and allow new sign-ups if new
     holiday people should still be able to register.
   - Emails: if the old project had a custom password-reset template (the app
     uses the 6-digit code) or custom SMTP, copy them across.
2. GitHub (holiday-schedule) → Actions → price-tracker → Disable workflow,
   so nothing writes to the old project during the copy.
3. Copy:

   ```bash
   export SOURCE_DB_URL='...old holiday project...'
   export TARGET_SERVICE_KEY='...shared project service role key...'
   export SOURCE_SERVICE_KEY='...old holiday project service role key...'
   bash supabase/consolidation/migrate-data.sh holiday
   ```

   This also copies the logins (same passwords; your account is merged with
   the one already here) and the stored files, and rewrites stored file links.
4. Vercel (holiday-schedule): `SUPABASE_SERVICE_ROLE_KEY` = the shared
   project's key. GitHub → Settings → Secrets → Actions: same for
   `SUPABASE_SERVICE_ROLE_KEY`.
5. Merge the holiday-schedule branch, then re-enable the price-tracker
   workflow.
6. Check: sign in with a password account and a Google account, check the
   chalkboard images load, and let one price-tracker run finish.
7. Pause the old holiday project.

## Afterwards

Delete the three paused projects after a week or two, once you're sure
nothing is missing. If a copy has to be redone before that app is switched,
`FORCE=1` empties its schema and copies again; never use it after the switch.
