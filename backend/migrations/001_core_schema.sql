-- =====================================================================
-- NIVORA migration 001 — core schema, security policies, matching
-- Idempotent: safe to run more than once. Run in Supabase SQL editor
-- (or `psql`) as the project owner BEFORE starting the backend.
--
-- IMPORTANT (security): this migration DROPS every existing RLS policy on
-- the NIVORA tables listed below and recreates a locked-down set. All
-- writes now go through the backend (service-role key). Direct writes from
-- the browser with the publishable key are denied.
-- Review it against your live database before running in production.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 0. Helpers
-- ---------------------------------------------------------------------
create or replace function public.nivora_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 1. Staff roles (admins / moderators). No policy for end users: only the
--    service role (backend) and the SQL editor can read or write it.
-- ---------------------------------------------------------------------
create table if not exists public.staff_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('admin','moderator')),
  created_at timestamptz not null default now()
);

create or replace function public.nivora_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_roles where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- 2. Profiles
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  age         integer not null,
  district    text,
  job_title   text,
  bio         text,
  approval_status text not null default 'pending',
  created_at  timestamptz not null default now()
);

alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists looking_for text;
alter table public.profiles add column if not exists relationship_intention text;
alter table public.profiles add column if not exists min_partner_age integer not null default 21;
alter table public.profiles add column if not exists max_partner_age integer not null default 40;
alter table public.profiles add column if not exists core_values text[] not null default '{}';
alter table public.profiles add column if not exists consent_terms_at timestamptz;
alter table public.profiles add column if not exists consent_privacy_at timestamptz;
alter table public.profiles add column if not exists consent_version text;
alter table public.profiles add column if not exists is_active boolean not null default true;
alter table public.profiles add column if not exists suspended_at timestamptz;
alter table public.profiles add column if not exists suspension_reason text;
alter table public.profiles add column if not exists reviewed_by uuid;
alter table public.profiles add column if not exists reviewed_at timestamptz;
alter table public.profiles add column if not exists review_reason text;
alter table public.profiles add column if not exists ai_risk_score integer;
alter table public.profiles add column if not exists ai_flags jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists ai_checked_at timestamptz;
alter table public.profiles add column if not exists ai_source text;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- Normalise legacy approval values, then replace any old CHECK on it.
update public.profiles set approval_status = 'pending'
 where approval_status is null
    or approval_status not in ('pending','approved','rejected','changes_requested');

do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.profiles'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%approval_status%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.profiles drop constraint if exists profiles_approval_status_chk;
alter table public.profiles add constraint profiles_approval_status_chk
  check (approval_status in ('pending','approved','rejected','changes_requested'));

alter table public.profiles drop constraint if exists profiles_age_chk;
alter table public.profiles add constraint profiles_age_chk check (age between 21 and 40) not valid;
alter table public.profiles drop constraint if exists profiles_gender_chk;
alter table public.profiles add constraint profiles_gender_chk
  check (gender is null or gender in ('woman','man','other'));
alter table public.profiles drop constraint if exists profiles_looking_for_chk;
alter table public.profiles add constraint profiles_looking_for_chk
  check (looking_for is null or looking_for in ('woman','man','any'));
alter table public.profiles drop constraint if exists profiles_intention_chk;
alter table public.profiles add constraint profiles_intention_chk
  check (relationship_intention is null or relationship_intention in ('marriage','longterm'));
alter table public.profiles drop constraint if exists profiles_partner_age_chk;
alter table public.profiles add constraint profiles_partner_age_chk
  check (min_partner_age between 21 and 40 and max_partner_age between 21 and 40
         and min_partner_age <= max_partner_age);
alter table public.profiles drop constraint if exists profiles_values_chk;
alter table public.profiles add constraint profiles_values_chk
  check (cardinality(core_values) <= 3);

create index if not exists profiles_status_idx on public.profiles (approval_status, created_at);

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.nivora_touch_updated_at();

-- Belt and braces: even if a policy is ever loosened by mistake, browser
-- roles (anon / authenticated) can never write profile rows directly.
create or replace function public.nivora_profiles_write_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') in ('anon','authenticated') then
    raise exception 'direct_profile_write_denied';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists profiles_write_guard on public.profiles;
create trigger profiles_write_guard before insert or update or delete on public.profiles
  for each row execute function public.nivora_profiles_write_guard();

-- ---------------------------------------------------------------------
-- 3. Matches
-- ---------------------------------------------------------------------
create table if not exists public.match_history (
  id         uuid primary key default gen_random_uuid(),
  user_one   uuid not null,
  user_two   uuid not null,
  started_at timestamptz,
  expires_at timestamptz,
  status     text not null default 'proposed',
  created_at timestamptz not null default now()
);

alter table public.match_history alter column started_at drop not null;
alter table public.match_history alter column expires_at drop not null;
alter table public.match_history add column if not exists user_one_accepted boolean not null default false;
alter table public.match_history add column if not exists user_two_accepted boolean not null default false;
alter table public.match_history add column if not exists proposal_expires_at timestamptz;
alter table public.match_history add column if not exists ended_at timestamptz;
alter table public.match_history add column if not exists ended_reason text;
alter table public.match_history add column if not exists ended_by uuid;

-- Legacy rows: treat existing 'active' rows as already-accepted.
update public.match_history
   set user_one_accepted = true, user_two_accepted = true
 where status = 'active';

do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.match_history'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.match_history drop constraint %I', c.conname);
  end loop;
end $$;

update public.match_history set status = 'ended'
 where status is null or status not in ('proposed','active','ended','declined','expired');

alter table public.match_history drop constraint if exists match_history_status_chk;
alter table public.match_history add constraint match_history_status_chk
  check (status in ('proposed','active','ended','declined','expired'));
alter table public.match_history drop constraint if exists match_history_distinct_users_chk;
alter table public.match_history add constraint match_history_distinct_users_chk
  check (user_one <> user_two) not valid;

create index if not exists match_history_user_one_idx on public.match_history (user_one, created_at desc);
create index if not exists match_history_user_two_idx on public.match_history (user_two, created_at desc);

-- One live (proposed or active) match per user. A primary key on user_id
-- enforces this across BOTH user_one and user_two columns.
create table if not exists public.match_members (
  user_id  uuid primary key,
  match_id uuid not null references public.match_history(id) on delete cascade
);

create or replace function public.nivora_release_members()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status not in ('proposed','active') then
    delete from public.match_members where match_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists match_history_release on public.match_history;
create trigger match_history_release after update of status on public.match_history
  for each row execute function public.nivora_release_members();

-- Expire stale proposals and 72-hour windows.
create or replace function public.nivora_expire_matches()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with e as (
    update public.match_history
       set status = 'expired', ended_at = now(), ended_reason = 'expired'
     where (status = 'proposed' and proposal_expires_at is not null and proposal_expires_at <= now())
        or (status = 'active' and expires_at is not null and expires_at <= now())
    returning 1)
  select count(*) into n from e;
  return n;
end $$;

-- Backfill members for legacy live matches (skips conflicts).
update public.match_history set status = 'expired', ended_at = now(), ended_reason = 'expired'
 where status = 'active' and expires_at is not null and expires_at <= now();
insert into public.match_members (user_id, match_id)
  select user_one, id from public.match_history where status in ('proposed','active')
  on conflict do nothing;
insert into public.match_members (user_id, match_id)
  select user_two, id from public.match_history where status in ('proposed','active')
  on conflict do nothing;

create table if not exists public.match_feedback (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.match_history(id) on delete cascade,
  reviewer_id uuid not null,
  wants_to_continue boolean not null,
  feedback_text text,
  created_at timestamptz not null default now()
);
create unique index if not exists match_feedback_one_per_user
  on public.match_feedback (match_id, reviewer_id);

-- ---------------------------------------------------------------------
-- 4. Blocks, reports, moderation, audit
-- ---------------------------------------------------------------------
create table if not exists public.blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  reported_id uuid references auth.users(id) on delete set null,
  match_id    uuid references public.match_history(id) on delete set null,
  reason      text not null,
  details     text,
  status      text not null default 'open' check (status in ('open','actioned','dismissed')),
  resolution  text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists reports_status_idx on public.reports (status, created_at);

create table if not exists public.moderation_events (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references auth.users(id) on delete cascade,
  admin_id    uuid,
  decision    text not null check (decision in ('approved','rejected','changes_requested','suspended','reinstated')),
  reason      text,
  ai_snapshot jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists moderation_events_profile_idx on public.moderation_events (profile_id, created_at desc);

create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  action      text not null,
  target_type text,
  target_id   text,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

-- ---------------------------------------------------------------------
-- 5. Chat and voice signalling
-- ---------------------------------------------------------------------
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.match_history(id) on delete cascade,
  sender_id  uuid not null,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists messages_match_idx on public.messages (match_id, created_at);

create table if not exists public.call_signals (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.match_history(id) on delete cascade,
  from_user  uuid not null,
  to_user    uuid not null,
  kind       text not null check (kind in ('offer','answer','ice','hangup')),
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists call_signals_to_idx on public.call_signals (to_user, created_at);

-- True only while the caller belongs to an ACTIVE match inside its 72h window.
create or replace function public.nivora_can_access_match(p_match uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.match_history m
     where m.id = p_match
       and auth.uid() in (m.user_one, m.user_two)
       and m.status = 'active'
       and m.expires_at is not null
       and m.expires_at > now());
$$;

-- ---------------------------------------------------------------------
-- 6. Payments (₹50 — verified server-side only)
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid,   -- deliberately no FK: financial records outlive account deletion
  provider            text not null default 'razorpay',
  provider_order_id   text not null unique,
  provider_payment_id text unique,
  amount_paise        integer not null check (amount_paise > 0),
  currency            text not null default 'INR',
  status              text not null default 'created' check (status in ('created','paid','failed','refunded')),
  receipt             text,
  created_at          timestamptz not null default now(),
  paid_at             timestamptz,
  consumed_at         timestamptz,
  consumed_match_id   uuid,
  updated_at          timestamptz not null default now()
);
create unique index if not exists payments_one_open_order_per_user
  on public.payments (user_id) where status = 'created';
create index if not exists payments_user_idx on public.payments (user_id, created_at desc);

drop trigger if exists payments_touch on public.payments;
create trigger payments_touch before update on public.payments
  for each row execute function public.nivora_touch_updated_at();

-- Idempotency for repeated webhook deliveries.
create table if not exists public.payment_webhook_events (
  event_id    text primary key,
  event_type  text,
  received_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. Matching functions (called ONLY by the backend with the service role)
-- ---------------------------------------------------------------------
drop function if exists public.nivora_find_partner();   -- legacy no-arg version trusted auth.uid()

create or replace function public.nivora_find_partner(p_user uuid, p_require_payment boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me      public.profiles%rowtype;
  cand    public.profiles%rowtype;
  new_id  uuid;
  pay_id  uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  perform public.nivora_expire_matches();

  select * into me from public.profiles where id = p_user;
  if not found then raise exception 'profile_missing'; end if;
  if me.approval_status <> 'approved' then raise exception 'not_approved'; end if;
  if not me.is_active or me.suspended_at is not null then raise exception 'inactive'; end if;
  if me.gender is null or me.looking_for is null or me.relationship_intention is null then
    raise exception 'profile_incomplete';
  end if;
  if exists (select 1 from public.match_members where user_id = p_user) then
    raise exception 'active_match_exists';
  end if;

  if p_require_payment then
    select id into pay_id from public.payments
     where user_id = p_user and status = 'paid' and consumed_at is null
     order by paid_at limit 1 for update skip locked;
    if pay_id is null then raise exception 'payment_required'; end if;
  end if;

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
     and (c.looking_for  = 'any' or c.looking_for  = me.gender)
     and not exists (select 1 from public.match_members m where m.user_id = c.id)
     and not exists (select 1 from public.blocks b
                      where (b.blocker_id = p_user and b.blocked_id = c.id)
                         or (b.blocker_id = c.id and b.blocked_id = p_user))
     and not exists (select 1 from public.match_history h
                      where (h.user_one = p_user and h.user_two = c.id)
                         or (h.user_one = c.id and h.user_two = p_user))
   order by coalesce(cardinality(array(
              select unnest(c.core_values) intersect select unnest(me.core_values))), 0) desc,
            random()
   limit 1
     for update of c skip locked;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  insert into public.match_history
    (user_one, user_two, status, started_at, expires_at, proposal_expires_at)
  values (p_user, cand.id, 'proposed', null, null, now() + interval '48 hours')
  returning id into new_id;

  -- PK on match_members.user_id makes a second live match impossible even
  -- under concurrent calls (raises unique_violation -> 23505).
  insert into public.match_members (user_id, match_id) values (p_user, new_id), (cand.id, new_id);

  if pay_id is not null then
    update public.payments set consumed_at = now(), consumed_match_id = new_id where id = pay_id;
  end if;

  return jsonb_build_object('found', true, 'match_id', new_id);
end $$;

create or replace function public.nivora_respond_match(p_user uuid, p_match uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.match_history%rowtype;
begin
  perform public.nivora_expire_matches();
  select * into m from public.match_history where id = p_match for update;
  if not found or p_user not in (m.user_one, m.user_two) then raise exception 'match_not_found'; end if;
  if m.status <> 'proposed' then raise exception 'match_not_proposed'; end if;

  if not p_accept then
    update public.match_history
       set status = 'declined', ended_at = now(), ended_by = p_user, ended_reason = 'declined'
     where id = p_match;
    return jsonb_build_object('status', 'declined');
  end if;

  if p_user = m.user_one then
    update public.match_history set user_one_accepted = true where id = p_match;
    m.user_one_accepted := true;
  else
    update public.match_history set user_two_accepted = true where id = p_match;
    m.user_two_accepted := true;
  end if;

  if m.user_one_accepted and m.user_two_accepted then
    update public.match_history
       set status = 'active', started_at = now(), expires_at = now() + interval '72 hours'
     where id = p_match;
    return jsonb_build_object('status', 'active');
  end if;
  return jsonb_build_object('status', 'proposed');
end $$;

create or replace function public.nivora_end_match(p_user uuid, p_match uuid, p_reason text default 'ended')
returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.match_history%rowtype;
begin
  select * into m from public.match_history where id = p_match for update;
  if not found or p_user not in (m.user_one, m.user_two) then raise exception 'match_not_found'; end if;
  if m.status not in ('proposed','active') then raise exception 'match_not_live'; end if;
  update public.match_history
     set status = 'ended', ended_at = now(), ended_by = p_user, ended_reason = p_reason
   where id = p_match;
  return jsonb_build_object('status', 'ended');
end $$;

-- Retention helper: schedule with pg_cron / Supabase scheduled functions.
create or replace function public.nivora_purge_old_data(p_retention_days integer default 30)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.nivora_expire_matches();
  delete from public.call_signals where created_at < now() - interval '1 day';
  delete from public.messages msg using public.match_history h
   where msg.match_id = h.id and h.status in ('ended','expired','declined')
     and h.ended_at < now() - make_interval(days => p_retention_days);
  delete from public.payment_webhook_events where received_at < now() - interval '90 days';
end $$;

-- ---------------------------------------------------------------------
-- 8. Row Level Security: drop old policies, recreate locked-down set
-- ---------------------------------------------------------------------
do $$
declare t text; p record;
begin
  foreach t in array array['profiles','match_history','match_members','match_feedback','blocks',
                           'reports','moderation_events','audit_log','messages','call_signals',
                           'payments','payment_webhook_events','staff_roles']
  loop
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Read-only access for signed-in users (needed for Supabase Realtime and nothing else).
grant select on public.match_history, public.messages, public.call_signals,
                public.payments, public.reports, public.blocks, public.match_feedback,
                public.moderation_events, public.audit_log to authenticated;
-- Profiles: column-level grant so a user can never read AI risk scores/flags or staff-only fields
-- through the public API, even for their own row. (The backend, using the service role, serves staff.)
grant select (id, full_name, age, district, gender, job_title, bio, looking_for, relationship_intention,
              min_partner_age, max_partner_age, core_values, approval_status, review_reason, is_active,
              consent_terms_at, consent_privacy_at, consent_version, created_at, updated_at)
  on public.profiles to authenticated;

create policy profiles_select_own   on public.profiles for select to authenticated
  using (id = auth.uid() or public.nivora_is_staff());
create policy match_select_member   on public.match_history for select to authenticated
  using (auth.uid() in (user_one, user_two) or public.nivora_is_staff());
create policy messages_select_live  on public.messages for select to authenticated
  using (public.nivora_can_access_match(match_id));
create policy signals_select_target on public.call_signals for select to authenticated
  using (to_user = auth.uid() and public.nivora_can_access_match(match_id));
create policy payments_select_own   on public.payments for select to authenticated
  using (user_id = auth.uid() or public.nivora_is_staff());
create policy reports_select        on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.nivora_is_staff());
create policy blocks_select_own     on public.blocks for select to authenticated
  using (blocker_id = auth.uid());
create policy feedback_select       on public.match_feedback for select to authenticated
  using (reviewer_id = auth.uid() or public.nivora_is_staff());
create policy moderation_select_staff on public.moderation_events for select to authenticated
  using (public.nivora_is_staff());
create policy audit_select_staff    on public.audit_log for select to authenticated
  using (public.nivora_is_staff());

-- Matching / lifecycle functions are service-role only.
revoke all on function public.nivora_find_partner(uuid, boolean)       from public, anon, authenticated;
revoke all on function public.nivora_respond_match(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.nivora_end_match(uuid, uuid, text)        from public, anon, authenticated;
revoke all on function public.nivora_expire_matches()                   from public, anon, authenticated;
revoke all on function public.nivora_purge_old_data(integer)            from public, anon, authenticated;
grant execute on function public.nivora_find_partner(uuid, boolean)       to service_role;
grant execute on function public.nivora_respond_match(uuid, uuid, boolean) to service_role;
grant execute on function public.nivora_end_match(uuid, uuid, text)        to service_role;
grant execute on function public.nivora_expire_matches()                   to service_role;
grant execute on function public.nivora_purge_old_data(integer)            to service_role;

-- ---------------------------------------------------------------------
-- 9. Realtime (chat messages + call signalling; RLS above still applies)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
      alter publication supabase_realtime add table public.messages;
    end if;
    if not exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'call_signals') then
      alter publication supabase_realtime add table public.call_signals;
    end if;
  end if;
end $$;
