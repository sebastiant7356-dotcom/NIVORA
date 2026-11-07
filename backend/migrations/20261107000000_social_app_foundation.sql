-- NIVORA social app foundation: persistent Shake chats, radius controls,
-- profile visibility, mutual friendships and worldwide anonymous posts.
-- Additive migration. Review and apply to Supabase before deploying the backend.

alter table public.shake_locations
  add column if not exists radius_km integer not null default 25;
alter table public.shake_locations
  drop constraint if exists shake_locations_radius_km_check;
alter table public.shake_locations
  add constraint shake_locations_radius_km_check check (radius_km between 1 and 100);

alter table public.profiles
  add column if not exists profile_visibility text not null default 'public';
alter table public.profiles
  drop constraint if exists profiles_profile_visibility_check;
alter table public.profiles
  add constraint profiles_profile_visibility_check check (profile_visibility in ('public','hidden'));

-- Friend conversations use the same chat transport, but never expire automatically.
alter table public.match_history drop constraint if exists match_history_match_source_check;
alter table public.match_history
  add constraint match_history_match_source_check check (match_source in ('daily','shake','friend'));

-- Existing composite match_members primary key already permits multiple conversations per member.
create index if not exists match_members_user_idx on public.match_members(user_id, match_id);

-- A friendship exists only after the recipient accepts the request.
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (sender_id <> recipient_id)
);
create unique index if not exists friend_requests_one_pending_pair
  on public.friend_requests(sender_id, recipient_id) where status = 'pending';
create index if not exists friend_requests_recipient_idx
  on public.friend_requests(recipient_id, status, created_at desc);

create table if not exists public.friendships (
  user_low uuid not null references auth.users(id) on delete cascade,
  user_high uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_low, user_high),
  check (user_low < user_high)
);
create index if not exists friendships_high_idx on public.friendships(user_high, user_low);

-- Anonymous to members: author_id is never returned by the public feed API.
-- Moderators can use the server-side author id when investigating a report.
create table if not exists public.anonymous_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  audience text not null default 'global' check (audience in ('global','kerala','radius')),
  radius_km integer,
  status text not null default 'published' check (status in ('published','removed')),
  created_at timestamptz not null default now(),
  check ((audience in ('global','kerala') and radius_km is null) or
         (audience = 'radius' and radius_km between 1 and 100))
);
alter table public.anonymous_posts add column if not exists latitude double precision;
alter table public.anonymous_posts add column if not exists longitude double precision;
create index if not exists anonymous_posts_feed_idx
  on public.anonymous_posts(status, created_at desc);
update public.anonymous_posts set audience='global' where audience='kerala';

alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.anonymous_posts enable row level security;
drop policy if exists friend_requests_no_browser_access on public.friend_requests;
create policy friend_requests_no_browser_access on public.friend_requests
  for all to anon, authenticated using (false) with check (false);
drop policy if exists friendships_no_browser_access on public.friendships;
create policy friendships_no_browser_access on public.friendships
  for all to anon, authenticated using (false) with check (false);
drop policy if exists anonymous_posts_no_browser_access on public.anonymous_posts;
create policy anonymous_posts_no_browser_access on public.anonymous_posts
  for all to anon, authenticated using (false) with check (false);
revoke all on public.friend_requests, public.friendships, public.anonymous_posts from anon, authenticated;
grant all on public.friend_requests, public.friendships, public.anonymous_posts to service_role;

-- Remove the old timer from already-created Shake chats as well.
update public.match_history set expires_at = null, proposal_expires_at = null
 where match_source in ('shake','friend') and status = 'active';

-- Shake chats do not expire. Daily legacy matches retain their existing expiry.
create or replace function public.nivora_expire_matches()
returns integer language plpgsql security definer set search_path = pg_catalog, public as $$
declare n integer;
begin
  with e as (
    update public.match_history
       set status = 'expired', ended_at = now(), ended_reason = 'expired'
     where status in ('proposed','active')
       and (match_source is distinct from 'shake' and match_source is distinct from 'friend')
       and expires_at is not null and expires_at <= now()
    returning 1)
  select count(*) into n from e;
  return n;
end $$;
revoke all on function public.nivora_expire_matches() from public, anon, authenticated;
grant execute on function public.nivora_expire_matches() to service_role;

-- The searching member's selected radius is authoritative for this search.
create or replace function public.nivora_shake_mutual_interest(p_user uuid, p_target uuid)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  existing_match public.match_history%rowtype;
  new_match uuid;
  loc_a public.shake_locations%rowtype;
  loc_b public.shake_locations%rowtype;
  pa public.profiles%rowtype;
  pb public.profiles%rowtype;
  km double precision;
begin
  if p_user is null or p_target is null or p_user = p_target then raise exception 'invalid_target'; end if;
  perform pg_advisory_xact_lock(hashtextextended(least(p_user::text,p_target::text),0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(p_user::text,p_target::text),0));

  if exists (select 1 from public.staff_roles where user_id in (p_user,p_target)) then raise exception 'staff_not_customer'; end if;
  select * into pa from public.profiles where id=p_user;
  select * into pb from public.profiles where id=p_target;
  if pa.id is null or pb.id is null or pa.approval_status <> 'approved' or pb.approval_status <> 'approved'
     or not pa.is_active or not pb.is_active or pa.suspended_at is not null or pb.suspended_at is not null
     or pb.profile_visibility = 'hidden' then raise exception 'profile_unavailable'; end if;
  if exists (select 1 from public.blocks where (blocker_id=p_user and blocked_id=p_target) or (blocker_id=p_target and blocked_id=p_user)) then raise exception 'blocked'; end if;

  select * into loc_a from public.shake_locations where user_id=p_user and enabled;
  select * into loc_b from public.shake_locations where user_id=p_target and enabled;
  if loc_a.user_id is null or loc_b.user_id is null then raise exception 'location_not_enabled'; end if;
  km := 6371 * 2 * asin(sqrt(
    power(sin(radians(loc_b.latitude-loc_a.latitude)/2),2) +
    cos(radians(loc_a.latitude))*cos(radians(loc_b.latitude))*power(sin(radians(loc_b.longitude-loc_a.longitude)/2),2)
  ));
  if loc_a.latitude not between -90 and 90 or loc_a.longitude not between -180 and 180
     or loc_b.latitude not between -90 and 90 or loc_b.longitude not between -180 and 180 then
    raise exception 'location_not_enabled';
  end if;
  if km > loc_a.radius_km then raise exception 'outside_radius'; end if;

  insert into public.shake_interests(from_user,to_user) values(p_user,p_target) on conflict do nothing;
  if not exists (select 1 from public.shake_interests where from_user=p_target and to_user=p_user) then
    return jsonb_build_object('mutual',false,'message','Interest sent. Waiting for the other person.');
  end if;

  select * into existing_match from public.match_history
   where status='active' and match_source in ('shake','friend')
     and ((user_one=p_user and user_two=p_target) or (user_one=p_target and user_two=p_user))
   order by created_at desc limit 1;
  if existing_match.id is not null then
    return jsonb_build_object('mutual',true,'match_id',existing_match.id,'existing',true);
  end if;

  insert into public.match_history(user_one,user_two,status,started_at,expires_at,user_one_accepted,user_two_accepted,match_source)
  values(p_user,p_target,'active',now(),null,true,true,'shake')
  returning id into new_match;
  insert into public.match_members(user_id,match_id) values(p_user,new_match),(p_target,new_match);
  delete from public.shake_interests where (from_user=p_user and to_user=p_target) or (from_user=p_target and to_user=p_user);
  return jsonb_build_object('mutual',true,'match_id',new_match,'existing',false);
end $$;
revoke all on function public.nivora_shake_mutual_interest(uuid,uuid) from public, anon, authenticated;
grant execute on function public.nivora_shake_mutual_interest(uuid,uuid) to service_role;

-- A friend request can be sent only from an active Shake conversation.
create or replace function public.nivora_open_friend_chat(p_user uuid, p_partner uuid)
returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  low_id uuid;
  high_id uuid;
  chat_id uuid;
  existing_source text;
begin
  if p_user is null or p_partner is null or p_user = p_partner then raise exception 'invalid_target'; end if;
  low_id := least(p_user,p_partner); high_id := greatest(p_user,p_partner);
  if not exists (select 1 from public.friendships where user_low=low_id and user_high=high_id) then
    raise exception 'not_friends';
  end if;
  if exists (select 1 from public.blocks where (blocker_id=p_user and blocked_id=p_partner) or (blocker_id=p_partner and blocked_id=p_user)) then
    raise exception 'blocked';
  end if;
  select id, match_source into chat_id, existing_source from public.match_history
   where status='active' and match_source in ('shake','friend')
     and ((user_one=p_user and user_two=p_partner) or (user_one=p_partner and user_two=p_user))
   order by case when match_source='friend' then 0 else 1 end, created_at desc limit 1;
  if chat_id is not null then
    if existing_source='shake' then
      update public.match_history set match_source='friend', expires_at=null, proposal_expires_at=null,
        user_one_accepted=true, user_two_accepted=true, started_at=coalesce(started_at,now())
       where id=chat_id;
    end if;
    return chat_id;
  end if;
  insert into public.match_history(user_one,user_two,status,started_at,expires_at,user_one_accepted,user_two_accepted,match_source)
  values(p_user,p_partner,'active',now(),null,true,true,'friend')
  returning id into chat_id;
  insert into public.match_members(user_id,match_id) values(p_user,chat_id),(p_partner,chat_id);
  return chat_id;
end $$;
revoke all on function public.nivora_open_friend_chat(uuid,uuid) from public, anon, authenticated;
grant execute on function public.nivora_open_friend_chat(uuid,uuid) to service_role;

create or replace function public.nivora_send_friend_request(p_user uuid, p_match uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  m public.match_history%rowtype;
  partner uuid;
  low_id uuid;
  high_id uuid;
  request_id uuid;
  friend_chat uuid;
begin
  select * into m from public.match_history where id=p_match and match_source='shake' and status='active'
    and p_user in (user_one,user_two);
  if m.id is null then raise exception 'match_not_found'; end if;
  partner := case when m.user_one=p_user then m.user_two else m.user_one end;
  if exists (select 1 from public.blocks where (blocker_id=p_user and blocked_id=partner) or (blocker_id=partner and blocked_id=p_user)) then raise exception 'blocked'; end if;
  low_id := least(p_user,partner); high_id := greatest(p_user,partner);
  if exists(select 1 from public.friendships where user_low=low_id and user_high=high_id) then
    friend_chat := public.nivora_open_friend_chat(p_user,partner);
    return jsonb_build_object('status','friends','chat_id',friend_chat);
  end if;
  select id into request_id from public.friend_requests
    where sender_id=partner and recipient_id=p_user and status='pending' limit 1;
  if request_id is not null then
    update public.friend_requests set status='accepted', responded_at=now() where id=request_id;
    insert into public.friendships(user_low,user_high) values(low_id,high_id) on conflict do nothing;
    friend_chat := public.nivora_open_friend_chat(p_user,partner);
    return jsonb_build_object('status','friends','chat_id',friend_chat);
  end if;
  insert into public.friend_requests(sender_id,recipient_id) values(p_user,partner)
    on conflict (sender_id,recipient_id) where status='pending' do nothing returning id into request_id;
  return jsonb_build_object('status','requested','request_id',request_id);
end $$;
revoke all on function public.nivora_send_friend_request(uuid,uuid) from public, anon, authenticated;
grant execute on function public.nivora_send_friend_request(uuid,uuid) to service_role;

create or replace function public.nivora_respond_friend_request(p_user uuid, p_request uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare r public.friend_requests%rowtype; low_id uuid; high_id uuid; friend_chat uuid;
begin
  select * into r from public.friend_requests where id=p_request and recipient_id=p_user and status='pending' for update;
  if r.id is null then raise exception 'request_not_found'; end if;
  if p_accept then
    if exists (select 1 from public.blocks where (blocker_id=p_user and blocked_id=r.sender_id) or (blocker_id=r.sender_id and blocked_id=p_user)) then
      raise exception 'blocked';
    end if;
    low_id := least(r.sender_id,r.recipient_id); high_id := greatest(r.sender_id,r.recipient_id);
    insert into public.friendships(user_low,user_high) values(low_id,high_id) on conflict do nothing;
    update public.friend_requests set status='accepted',responded_at=now() where id=p_request;
    friend_chat := public.nivora_open_friend_chat(p_user,r.sender_id);
    return jsonb_build_object('status','friends','chat_id',friend_chat);
  end if;
  update public.friend_requests set status='declined',responded_at=now() where id=p_request;
  return jsonb_build_object('status','declined');
end $$;
revoke all on function public.nivora_respond_friend_request(uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.nivora_respond_friend_request(uuid,uuid,boolean) to service_role;
