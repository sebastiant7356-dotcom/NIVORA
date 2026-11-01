-- NIVORA 004: harden helper-function execution and search paths.
-- SECURITY DEFINER helpers used by RLS remain callable by authenticated users only;
-- trigger/event-trigger helpers are not RPC APIs and are not executable by browser roles.

alter function public.nivora_touch_updated_at()
  set search_path = pg_catalog;

alter function public.nivora_can_access_match(uuid)
  set search_path = pg_catalog, public;
alter function public.nivora_is_staff()
  set search_path = pg_catalog, public;

revoke all on function public.nivora_touch_updated_at() from public, anon, authenticated;
revoke all on function public.nivora_profiles_write_guard() from public, anon, authenticated;
revoke all on function public.nivora_release_members() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

revoke all on function public.nivora_can_access_match(uuid) from public, anon;
grant execute on function public.nivora_can_access_match(uuid) to authenticated, service_role;

revoke all on function public.nivora_is_staff() from public, anon;
grant execute on function public.nivora_is_staff() to authenticated, service_role;
