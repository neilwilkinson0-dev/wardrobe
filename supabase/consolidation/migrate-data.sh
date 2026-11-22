#!/usr/bin/env bash
# One-off copy of the meetings, piano and holiday-schedule data into this
# (wardrobe) Supabase project, which now hosts all four apps in their own schemas.
#
# The schemas themselves already exist (supabase/migrations/20261019*). This
# script only moves rows, holiday-schedule's logins and its storage files.
#
# Needs: pg_dump/psql 17+, curl, python3.
#
# Usage (connection strings: Supabase dashboard > Connect > Session pooler;
#        service role keys: Project Settings > API Keys):
#
#   export TARGET_DB_URL='postgresql://postgres.nvdcdghoiqmncregbknm:...@...pooler.supabase.com:5432/postgres'
#   export MEETINGS_DB_URL='postgresql://postgres.etcehyuywewsukksnhmf:...'
#   export PIANO_DB_URL='postgresql://postgres.jochehygpypjbrrayxkc:...'
#   export HOLIDAY_DB_URL='postgresql://postgres.kzdhgzeqylzxbfdputih:...'
#   export TARGET_SERVICE_KEY='...'     # shared (wardrobe) project
#   export HOLIDAY_SERVICE_KEY='...'    # old holiday-schedule project
#   bash supabase/consolidation/migrate-data.sh
#
# It refuses to touch a schema that already has rows, so it can't wipe data the
# apps have written after the switch. Set FORCE=1 to empty the three schemas and
# copy again (only before the apps are pointed at this project).
set -euo pipefail

: "${TARGET_DB_URL:?}" "${MEETINGS_DB_URL:?}" "${PIANO_DB_URL:?}" "${HOLIDAY_DB_URL:?}"
: "${TARGET_SERVICE_KEY:?}" "${HOLIDAY_SERVICE_KEY:?}"

TARGET_REF=nvdcdghoiqmncregbknm
HOLIDAY_REF=kzdhgzeqylzxbfdputih
TARGET_URL="https://$TARGET_REF.supabase.co"
HOLIDAY_URL="https://$HOLIDAY_REF.supabase.co"

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

tgt() { psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -q "$@"; }

row_count() {
  tgt -Atc "select coalesce(sum((xpath('/row/c/text()', query_to_xml(format('select count(*) c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::int), 0)
            from information_schema.tables
            where table_schema = '$1' and table_type = 'BASE TABLE' and (table_schema, table_name) <> ('piano', 'owners')"
}

prepare_schema() {
  local schema=$1 n
  n=$(row_count "$schema")
  if [ "$n" != "0" ]; then
    if [ "${FORCE:-}" != "1" ]; then
      echo "Schema $schema already has $n rows. Re-run with FORCE=1 to empty it and copy again." >&2
      exit 1
    fi
    echo "Emptying $schema"
    tgt -c "do \$\$ declare t record; begin
              for t in select table_name from information_schema.tables
                       where table_schema = '$schema' and table_type = 'BASE TABLE' and ('$schema', table_name) <> ('piano', 'owners')
              loop execute format('truncate %I.%I restart identity cascade', '$schema', t.table_name); end loop;
            end \$\$;"
  fi
}

dump_public() {
  local src=$1 schema=$2
  pg_dump "$src" --data-only --schema=public --no-owner --no-privileges \
    | sed -e "s/^COPY public\./COPY $schema./" \
          -e "s/pg_catalog\.setval('public\./pg_catalog.setval('$schema./" \
    > "$WORK/$schema.sql"
}

warn_if_files() {
  local src=$1 name=$2 n
  n=$(psql "$src" -Atc "select count(*) from storage.objects")
  if [ "$n" != "0" ]; then
    echo "WARNING: $name has $n stored files that this script does not copy. Copy them before deleting that project." >&2
  fi
}

# ---- meetings --------------------------------------------------------------
echo "== meetings"
prepare_schema meetings
dump_public "$MEETINGS_DB_URL" meetings
tgt --single-transaction -f "$WORK/meetings.sql" > /dev/null
warn_if_files "$MEETINGS_DB_URL" meetings

# ---- piano -----------------------------------------------------------------
echo "== piano"
prepare_schema piano
dump_public "$PIANO_DB_URL" piano
tgt --single-transaction -f "$WORK/piano.sql" > /dev/null
warn_if_files "$PIANO_DB_URL" piano

# ---- holiday: logins -------------------------------------------------------
# Holiday-schedule's users are copied with their ids, passwords and Google links.
# Anyone who already exists here (matched by email) keeps their id here, and
# holiday.users is pointed at it.
echo "== holiday logins"
prepare_schema holiday
tgt -c "drop schema if exists migration_staging cascade;
        create schema migration_staging;
        create table migration_staging.users (like auth.users);
        create table migration_staging.identities (like auth.identities);"
pg_dump "$HOLIDAY_DB_URL" --data-only --no-owner --no-privileges --table=auth.users --table=auth.identities \
  | sed -e "s/^COPY auth\./COPY migration_staging./" \
  > "$WORK/holiday_auth.sql"
tgt --single-transaction -f "$WORK/holiday_auth.sql" > /dev/null

tgt --single-transaction <<'SQL'
create table migration_staging.id_map as
  select s.id as old_id, coalesce(u.id, s.id) as new_id, u.id is null as is_new
  from migration_staging.users s
  left join auth.users u on lower(u.email) = lower(s.email);

do $$
declare
  user_cols text;
  ident_cols text;
  ident_select text;
begin
  select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position) into user_cols
  from information_schema.columns c
  where c.table_schema = 'auth' and c.table_name = 'users' and c.is_generated = 'NEVER';

  execute format(
    'insert into auth.users (%s) select %s from migration_staging.users
     where id in (select old_id from migration_staging.id_map where is_new)',
    user_cols, user_cols);

  select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position),
         string_agg(case when c.column_name = 'user_id' then 'm.new_id' else 'i.' || quote_ident(c.column_name) end, ', ' order by c.ordinal_position)
    into ident_cols, ident_select
  from information_schema.columns c
  where c.table_schema = 'auth' and c.table_name = 'identities' and c.is_generated = 'NEVER';

  -- New users get all their identities; existing users gain any sign-in method
  -- they only had in holiday-schedule (e.g. email + password).
  execute format(
    'insert into auth.identities (%s) select %s from migration_staging.identities i
     join migration_staging.id_map m on m.old_id = i.user_id
     on conflict do nothing',
    ident_cols, ident_select);
end $$;

-- Keep a holiday-schedule password for users who only had Google sign-in here.
update auth.users u
set encrypted_password = s.encrypted_password
from migration_staging.users s
join migration_staging.id_map m on m.old_id = s.id
where u.id = m.new_id and not m.is_new
  and coalesce(u.encrypted_password, '') = '' and coalesce(s.encrypted_password, '') <> '';

-- Inserting into auth.users fires wardrobe's starter-wardrobe trigger; holiday
-- people don't use wardrobe, so drop those starter rows again.
delete from public.categories where user_id in (select new_id from migration_staging.id_map where is_new);
delete from public.preferences where user_id in (select new_id from migration_staging.id_map where is_new);
SQL

# ---- holiday: data ---------------------------------------------------------
echo "== holiday data"
dump_public "$HOLIDAY_DB_URL" holiday
{
  echo "alter table holiday.users drop constraint users_auth_user_id_fkey;"
  cat "$WORK/holiday.sql"
  echo "update holiday.users h set auth_user_id = m.new_id from migration_staging.id_map m where h.auth_user_id = m.old_id;"
  echo "alter table holiday.users add constraint users_auth_user_id_fkey foreign key (auth_user_id) references auth.users(id) on delete set null;"
  echo "update holiday.chalkboard_images set image_url = replace(image_url, '$HOLIDAY_REF', '$TARGET_REF');"
  echo "update holiday.settings set value = replace(value, '$HOLIDAY_REF', '$TARGET_REF');"
  echo "update holiday.bh_settings set value = replace(value, '$HOLIDAY_REF', '$TARGET_REF');"
} > "$WORK/holiday_load.sql"
tgt --single-transaction -f "$WORK/holiday_load.sql" > /dev/null
tgt -c "drop schema migration_staging cascade;" 2> /dev/null

# ---- holiday: storage files ------------------------------------------------
echo "== holiday files"
psql "$HOLIDAY_DB_URL" -At -F $'\t' -c "select bucket_id, name, coalesce(metadata->>'mimetype', 'application/octet-stream') from storage.objects order by 1, 2" \
  > "$WORK/objects.tsv"
while IFS=$'\t' read -r bucket name mime; do
  path=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1]))' "$name")
  curl -fsS -H "Authorization: Bearer $HOLIDAY_SERVICE_KEY" -H "apikey: $HOLIDAY_SERVICE_KEY" \
    "$HOLIDAY_URL/storage/v1/object/$bucket/$path" -o "$WORK/blob"
  curl -fsS -X POST -H "Authorization: Bearer $TARGET_SERVICE_KEY" -H "apikey: $TARGET_SERVICE_KEY" \
    -H "Content-Type: $mime" -H "x-upsert: true" --data-binary @"$WORK/blob" \
    "$TARGET_URL/storage/v1/object/$bucket/$path" > /dev/null
  echo "  $bucket/$name"
done < "$WORK/objects.tsv"

# ---- check -----------------------------------------------------------------
echo "== row counts (old project -> shared project)"
for pair in "meetings:$MEETINGS_DB_URL" "piano:$PIANO_DB_URL" "holiday:$HOLIDAY_DB_URL"; do
  schema=${pair%%:*}; src=${pair#*:}
  psql "$src" -At -F ' ' -c "select table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) c from public.%I', table_name), false, true, '')))[1]::text
                             from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1" \
  | while read -r table n; do
      m=$(tgt -Atc "select count(*) from $schema.$table")
      flag=$([ "$n" = "$m" ] && echo ok || echo MISMATCH)
      printf '  %-10s %-28s %7s -> %-7s %s\n' "$schema" "$table" "$n" "$m" "$flag"
    done
done
echo "Done."
