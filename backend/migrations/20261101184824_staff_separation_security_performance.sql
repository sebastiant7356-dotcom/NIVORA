-- Exclude staff from customer matching and harden backend-only tables.
create or replace function public.nivora_find_partner(
  p_user uuid,
  p_require_payment boolean default false
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  me public.profiles%rowtype;
  cand public.profiles%rowtype;
  new_id uuid;
  pay_id uuid;
  today_kerala date := (now() at time zone 'Asia/Kolkata')::date;
  used_today integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  perform public.nivora_expire_matches();

  if exists (select 1 from public.staff_roles where user_id = p_user) then
    raise exception 'staff_not_customer';
  end if;

  select * into me from public.profiles where id = p_user for update;
  if not found then raise exception 'profile_missing'; end if;
  if me.approval_status <> 'approved' then raise exception 'not_approved'; end if;
  if not me.is_active or me.suspended_at is not null then raise exception 'inactive'; end if;
  if me.gender is null or me.looking_for is null or me.relationship_intention is null then
    raise exception 'profile_incomplete';
  end if;

  select coalesce(matches_count, 0) into used_today
    from public.match_daily_usage
   where user_id = p_user and usage_date = today_kerala;
  used_today := coalesce(used_today, 0);
  if used_today >= 5 then raise exception 'daily_match_limit_reached'; end if;

  if p_require_payment then
    select id into pay_id from public.payments
     where user_id = p_user and status = 'paid' and consumed_at is null
     order by paid_at limit 1 for update skip locked;
    if pay_id is null then raise exception 'payment_required'; end if;
  end if;

  select c.* into cand
    from public.profiles c
   where c.id <> p_user
     and not exists (select 1 from public.staff_roles sr where sr.user_id = c.id)
     and c.approval_status = 'approved'
     and c.is_active and c.suspended_at is null
     and c.gender is not null and c.looking_for is not null
     and c.relationship_intention = me.relationship_intention
     and c.age between me.min_partner_age and me.max_partner_age
     and me.age between c.min_partner_age and c.max_partner_age
     and (me.looking_for = 'any' or me.looking_for = c.gender)
     and (c.looking_for = 'any' or c.looking_for = me.gender)
     and not exists (
       select 1 from public.match_daily_usage du
        where du.user_id = c.id and du.usage_date = today_kerala and du.matches_count >= 5
     )
     and not exists (
       select 1 from public.blocks b
        where (b.blocker_id = p_user and b.blocked_id = c.id)
           or (b.blocker_id = c.id and b.blocked_id = p_user)
     )
     and not exists (
       select 1 from public.match_history h
        where (h.user_one = p_user and h.user_two = c.id)
           or (h.user_one = c.id and h.user_two = p_user)
     )
   order by coalesce(cardinality(array(
              select unnest(c.core_values) intersect select unnest(me.core_values))), 0) desc,
            random()
   limit 1
   for update of c skip locked;

  if not found then
    return jsonb_build_object('found', false, 'daily_used', used_today, 'daily_limit', 5);
  end if;

  insert into public.match_history
    (user_one, user_two, status, started_at, expires_at, proposal_expires_at)
  values (p_user, cand.id, 'proposed', null, null, now() + interval '72 hours')
  returning id into new_id;

  insert into public.match_members (user_id, match_id)
  values (p_user, new_id), (cand.id, new_id);

  insert into public.match_daily_usage (user_id, usage_date, matches_count, updated_at)
  values (p_user, today_kerala, 1, now()), (cand.id, today_kerala, 1, now())
  on conflict (user_id, usage_date) do update
    set matches_count = public.match_daily_usage.matches_count + 1,
        updated_at = now();

  select matches_count into used_today from public.match_daily_usage
   where user_id = p_user and usage_date = today_kerala;

  if pay_id is not null then
    update public.payments set consumed_at = now(), consumed_match_id = new_id where id = pay_id;
  end if;

  return jsonb_build_object('found', true, 'match_id', new_id,
    'daily_used', used_today, 'daily_limit', 5);
end;
$$;
revoke all on function public.nivora_find_partner(uuid, boolean) from public, anon, authenticated;
grant execute on function public.nivora_find_partner(uuid, boolean) to service_role;

-- Explicit deny policies document that these tables are backend/service-role only.
drop policy if exists match_daily_usage_deny_browser on public.match_daily_usage;
create policy match_daily_usage_deny_browser on public.match_daily_usage
  for all to anon, authenticated using (false) with check (false);
drop policy if exists match_members_deny_browser on public.match_members;
create policy match_members_deny_browser on public.match_members
  for all to anon, authenticated using (false) with check (false);
drop policy if exists payment_webhook_events_deny_browser on public.payment_webhook_events;
create policy payment_webhook_events_deny_browser on public.payment_webhook_events
  for all to anon, authenticated using (false) with check (false);
drop policy if exists profile_photos_deny_browser on public.profile_photos;
create policy profile_photos_deny_browser on public.profile_photos
  for all to anon, authenticated using (false) with check (false);
drop policy if exists staff_roles_deny_browser on public.staff_roles;
create policy staff_roles_deny_browser on public.staff_roles
  for all to anon, authenticated using (false) with check (false);
drop policy if exists voice_messages_deny_browser on public.voice_messages;
create policy voice_messages_deny_browser on public.voice_messages
  for all to anon, authenticated using (false) with check (false);

-- Keep helper functions callable by authenticated users only where RLS policies require them.
-- They return only booleans scoped to auth.uid(); service-role matching remains separately restricted.
-- Replace per-row auth.uid() evaluation with a scalar subquery for policy efficiency.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated
  using ((id = (select auth.uid())) or public.nivora_is_staff());

drop policy if exists match_select_member on public.match_history;
create policy match_select_member on public.match_history for select to authenticated
  using (((select auth.uid()) = user_one) or ((select auth.uid()) = user_two) or public.nivora_is_staff());

drop policy if exists signals_select_target on public.call_signals;
create policy signals_select_target on public.call_signals for select to authenticated
  using ((to_user = (select auth.uid())) and public.nivora_can_access_match(match_id));

drop policy if exists payments_select_own on public.payments;
create policy payments_select_own on public.payments for select to authenticated
  using ((user_id = (select auth.uid())) or public.nivora_is_staff());

drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports for select to authenticated
  using ((reporter_id = (select auth.uid())) or public.nivora_is_staff());

drop policy if exists feedback_select on public.match_feedback;
create policy feedback_select on public.match_feedback for select to authenticated
  using ((reviewer_id = (select auth.uid())) or public.nivora_is_staff());

drop policy if exists blocks_select_own on public.blocks;
create policy blocks_select_own on public.blocks for select to authenticated
  using (blocker_id = (select auth.uid()));

-- The chat-window policy covers proposed and active matches and also checks blocks.
-- The older active-only policy is redundant and can be removed.
drop policy if exists messages_select_live on public.messages;

-- Missing FK indexes reported by Supabase's performance advisor.
create index if not exists blocks_blocked_id_idx on public.blocks (blocked_id);
create index if not exists call_signals_match_id_idx on public.call_signals (match_id);
create index if not exists profile_photos_reviewed_by_idx on public.profile_photos (reviewed_by);
create index if not exists reports_match_id_idx on public.reports (match_id);
create index if not exists reports_reported_id_idx on public.reports (reported_id);
create index if not exists reports_reporter_id_idx on public.reports (reporter_id);
