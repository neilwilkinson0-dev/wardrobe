-- handle_new_user() is a trigger function only; Postgres already refuses to run it
-- outside trigger context, but revoke RPC execute rights too so it's never exposed
-- via PostgREST.
revoke execute on function public.handle_new_user() from anon, authenticated;
