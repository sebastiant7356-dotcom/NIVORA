-- Backend service-role reads match membership to build the signed-in user's conversation list.
-- Browser roles remain blocked by RLS and have no direct access.
grant select on table public.match_members to service_role;
