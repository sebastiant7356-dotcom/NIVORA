-- Move SECURITY DEFINER RLS helpers out of the exposed public API schema.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.nivora_is_staff()
returns boolean
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
     and exists (select 1 from public.staff_roles where user_id = auth.uid());
$$;

create or replace function private.nivora_can_access_match(p_match uuid)
returns boolean
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.match_history m
     where m.id = p_match
       and auth.uid() in (m.user_one, m.user_two)
       and m.status = 'active'
       and m.expires_at is not null
       and m.expires_at > now()
  );
$$;

create or replace function private.nivora_can_access_chat(p_match uuid)
returns boolean
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.match_history m
     where m.id = p_match
       and auth.uid() in (m.user_one, m.user_two)
       and m.status in ('proposed','active')
       and m.expires_at is not null
       and m.expires_at > now()
       and not exists (
         select 1 from public.blocks b
          where (b.blocker_id = m.user_one and b.blocked_id = m.user_two)
             or (b.blocker_id = m.user_two and b.blocked_id = m.user_one)
       )
  );
$$;

revoke all on function private.nivora_is_staff() from public, anon;
revoke all on function private.nivora_can_access_match(uuid) from public, anon;
revoke all on function private.nivora_can_access_chat(uuid) from public, anon;
grant execute on function private.nivora_is_staff() to authenticated;
grant execute on function private.nivora_can_access_match(uuid) to authenticated;
grant execute on function private.nivora_can_access_chat(uuid) to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated
  using ((id = (select auth.uid())) or private.nivora_is_staff());

drop policy if exists match_select_member on public.match_history;
create policy match_select_member on public.match_history for select to authenticated
  using (((select auth.uid()) = user_one) or ((select auth.uid()) = user_two) or private.nivora_is_staff());

drop policy if exists signals_select_target on public.call_signals;
create policy signals_select_target on public.call_signals for select to authenticated
  using ((to_user = (select auth.uid())) and private.nivora_can_access_match(match_id));

drop policy if exists payments_select_own on public.payments;
create policy payments_select_own on public.payments for select to authenticated
  using ((user_id = (select auth.uid())) or private.nivora_is_staff());

drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports for select to authenticated
  using ((reporter_id = (select auth.uid())) or private.nivora_is_staff());

drop policy if exists feedback_select on public.match_feedback;
create policy feedback_select on public.match_feedback for select to authenticated
  using ((reviewer_id = (select auth.uid())) or private.nivora_is_staff());

drop policy if exists moderation_select_staff on public.moderation_events;
create policy moderation_select_staff on public.moderation_events for select to authenticated
  using (private.nivora_is_staff());

drop policy if exists audit_select_staff on public.audit_log;
create policy audit_select_staff on public.audit_log for select to authenticated
  using (private.nivora_is_staff());

drop policy if exists messages_select_chat_window on public.messages;
create policy messages_select_chat_window on public.messages for select to authenticated
  using (private.nivora_can_access_chat(match_id));

revoke all on function public.nivora_is_staff() from public, anon, authenticated;
revoke all on function public.nivora_can_access_match(uuid) from public, anon, authenticated;
revoke all on function public.nivora_can_access_chat(uuid) from public, anon, authenticated;
drop function public.nivora_is_staff();
drop function public.nivora_can_access_match(uuid);
drop function public.nivora_can_access_chat(uuid);

create index if not exists voice_messages_sender_created_idx
  on public.voice_messages (sender_id, created_at);
