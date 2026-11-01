-- NIVORA 002: chat starts at match creation; 72-hour shared window.
-- Additive: preserves existing RLS policies and tables.

create or replace function public.nivora_set_match_window()
returns trigger language plpgsql as $$
begin
  if new.status = 'proposed' then
    new.started_at := coalesce(new.started_at, new.created_at, now());
    new.expires_at := new.started_at + interval '72 hours';
    new.proposal_expires_at := new.expires_at;
  end if;
  return new;
end $$;

drop trigger if exists nivora_match_window on public.match_history;
create trigger nivora_match_window
before insert on public.match_history
for each row execute function public.nivora_set_match_window();

-- Backfill existing pending matches from their original creation time.
update public.match_history
   set started_at = coalesce(started_at, created_at, now()),
       expires_at = coalesce(started_at, created_at, now()) + interval '72 hours',
       proposal_expires_at = coalesce(started_at, created_at, now()) + interval '72 hours'
 where status = 'proposed';

create or replace function public.nivora_expire_matches()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with e as (
    update public.match_history
       set status = 'expired', ended_at = now(), ended_reason = 'expired'
     where status in ('proposed','active')
       and expires_at is not null and expires_at <= now()
    returning 1)
  select count(*) into n from e;
  return n;
end $$;

create or replace function public.nivora_respond_match(
  p_user uuid, p_match uuid, p_accept boolean
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.match_history%rowtype;
begin
  perform public.nivora_expire_matches();
  select * into m from public.match_history where id = p_match for update;

  if not found or p_user not in (m.user_one, m.user_two) then
    raise exception 'match_not_found';
  end if;

  if m.status = 'active' and p_accept then
    return jsonb_build_object('status', 'active');
  end if;

  if m.status <> 'proposed' then
    raise exception 'match_not_proposed';
  end if;

  if not p_accept then
    update public.match_history
       set status = 'declined', ended_at = now(),
           ended_by = p_user, ended_reason = 'user_decided_stop'
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
    update public.match_history set status = 'active' where id = p_match;
    return jsonb_build_object('status', 'active');
  end if;

  return jsonb_build_object('status', 'proposed');
end $$;

create or replace function public.nivora_can_access_chat(p_match uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.match_history m
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

-- A separate permissive SELECT policy adds proposed-match chat access.
-- Existing active-chat and voice-call policies remain untouched.
drop policy if exists messages_select_chat_window on public.messages;
create policy messages_select_chat_window
on public.messages for select to authenticated
using (public.nivora_can_access_chat(match_id));

revoke all on function public.nivora_can_access_chat(uuid) from public, anon;
grant execute on function public.nivora_can_access_chat(uuid) to authenticated, service_role;

revoke all on function public.nivora_respond_match(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.nivora_respond_match(uuid, uuid, boolean) to service_role;

revoke all on function public.nivora_expire_matches() from public, anon, authenticated;
grant execute on function public.nivora_expire_matches() to service_role;
