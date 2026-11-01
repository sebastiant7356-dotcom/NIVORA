-- NIVORA 005: pin the match-window trigger function search path.
alter function public.nivora_set_match_window()
  set search_path = pg_catalog, public;
revoke all on function public.nivora_set_match_window() from public, anon, authenticated;
