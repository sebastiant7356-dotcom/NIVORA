-- NIVORA free launch: five successful recommendations per member per Kerala calendar day.
-- Existing match history and match membership rows are preserved.
-- A user may keep multiple proposed/active conversations, but never receive
-- more than five recommendations in a Kerala-local calendar day.

create table if not exists public.match_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  matches_count integer not null default 0 check (matches_count between 0 and 5),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);
alter table public.match_daily_usage enable row level security;
revoke all on public.match_daily_usage from anon, authenticated;

-- The current one-match-per-user primary key is replaced with a composite key.
-- Existing rows remain in place; current schema guarantees at most one row per user.
alter table public.match_members
  drop constraint if exists match_members_pkey;
alter table public.match_members
  add constraint match_members_pkey primary key (user_id, match_id);
create index if not exists match_members_match_idx on public.match_members (match_id);

-- Prevent duplicate pairs regardless of request direction.
create unique index if not exists match_history_pair_unique_idx
  on public.match_history (least(user_one, user_two), greatest(user_one, user_two));

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
  -- Serialize concurrent requests by the same member.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  perform public.nivora_expire_matches();

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

  -- Lock the chosen candidate row. This prevents simultaneous requests from
  -- consuming the same candidate's remaining daily recommendation quota.
  select c.* into cand
    from public.profiles c
   where c.id <> p_user
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

  return jsonb_build_object(
    'found', true, 'match_id', new_id,
    'daily_used', used_today, 'daily_limit', 5
  );
end;
$$;

revoke all on function public.nivora_find_partner(uuid, boolean) from public, anon, authenticated;
grant execute on function public.nivora_find_partner(uuid, boolean) to service_role;
