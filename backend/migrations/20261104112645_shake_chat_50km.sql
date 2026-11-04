-- Optional, privacy-preserving 50 km Shake & Chat discovery.
create table if not exists public.shake_locations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
create index if not exists shake_locations_enabled_idx on public.shake_locations(enabled) where enabled = true;

create table if not exists public.shake_interests (
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_user, to_user),
  check (from_user <> to_user)
);
create index if not exists shake_interests_to_idx on public.shake_interests(to_user, created_at desc);

alter table public.shake_locations enable row level security;
alter table public.shake_interests enable row level security;
drop policy if exists shake_locations_no_browser_access on public.shake_locations;
create policy shake_locations_no_browser_access on public.shake_locations for all to anon, authenticated using (false) with check (false);
drop policy if exists shake_interests_no_browser_access on public.shake_interests;
create policy shake_interests_no_browser_access on public.shake_interests for all to anon, authenticated using (false) with check (false);
revoke all on public.shake_locations, public.shake_interests from anon, authenticated;
grant all on public.shake_locations, public.shake_interests to service_role;

create or replace function public.nivora_shake_mutual_interest(p_user uuid, p_target uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  existing_match public.match_history%rowtype;
  new_match uuid;
  loc_a public.shake_locations%rowtype;
  loc_b public.shake_locations%rowtype;
  pa public.profiles%rowtype;
  pb public.profiles%rowtype;
  km double precision;
begin
  if p_user is null or p_target is null or p_user = p_target then
    raise exception 'invalid_target';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(least(p_user::text,p_target::text),0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(p_user::text,p_target::text),0));

  if exists (select 1 from public.staff_roles where user_id in (p_user,p_target)) then
    raise exception 'staff_not_customer';
  end if;
  select * into pa from public.profiles where id=p_user;
  select * into pb from public.profiles where id=p_target;
  if pa.id is null or pb.id is null or pa.approval_status <> 'approved' or pb.approval_status <> 'approved'
     or not pa.is_active or not pb.is_active or pa.suspended_at is not null or pb.suspended_at is not null then
    raise exception 'profile_unavailable';
  end if;
  if not ((pa.looking_for='any' or pa.looking_for=pb.gender) and (pb.looking_for='any' or pb.looking_for=pa.gender)
      and pb.age between pa.min_partner_age and pa.max_partner_age
      and pa.age between pb.min_partner_age and pb.max_partner_age) then
    raise exception 'not_compatible';
  end if;
  if exists (select 1 from public.blocks where (blocker_id=p_user and blocked_id=p_target) or (blocker_id=p_target and blocked_id=p_user)) then
    raise exception 'blocked';
  end if;
  select * into loc_a from public.shake_locations where user_id=p_user and enabled;
  select * into loc_b from public.shake_locations where user_id=p_target and enabled;
  if loc_a.user_id is null or loc_b.user_id is null then raise exception 'location_not_enabled'; end if;
  km := 6371 * 2 * asin(sqrt(
    power(sin(radians(loc_b.latitude-loc_a.latitude)/2),2) +
    cos(radians(loc_a.latitude))*cos(radians(loc_b.latitude))*power(sin(radians(loc_b.longitude-loc_a.longitude)/2),2)
  ));
  if km > 50 then raise exception 'outside_radius'; end if;

  insert into public.shake_interests(from_user,to_user) values(p_user,p_target) on conflict do nothing;
  if not exists (select 1 from public.shake_interests where from_user=p_target and to_user=p_user) then
    return jsonb_build_object('mutual',false,'message','Interest sent. Waiting for the other person.');
  end if;

  select * into existing_match from public.match_history
   where status in ('proposed','active')
     and ((user_one=p_user and user_two=p_target) or (user_one=p_target and user_two=p_user))
   order by created_at desc limit 1;
  if existing_match.id is not null then
    return jsonb_build_object('mutual',true,'match_id',existing_match.id,'existing',true);
  end if;

  if exists (select 1 from public.match_members where user_id in (p_user,p_target)) then
    raise exception 'active_match_exists';
  end if;

  insert into public.match_history(user_one,user_two,status,started_at,expires_at,user_one_accepted,user_two_accepted)
  values(p_user,p_target,'active',now(),now()+interval '72 hours',true,true)
  returning id into new_match;
  insert into public.match_members(user_id,match_id) values(p_user,new_match),(p_target,new_match);
  delete from public.shake_interests where (from_user=p_user and to_user=p_target) or (from_user=p_target and to_user=p_user);
  return jsonb_build_object('mutual',true,'match_id',new_match,'existing',false);
end;
$$;
revoke all on function public.nivora_shake_mutual_interest(uuid,uuid) from public, anon, authenticated;
grant execute on function public.nivora_shake_mutual_interest(uuid,uuid) to service_role;
