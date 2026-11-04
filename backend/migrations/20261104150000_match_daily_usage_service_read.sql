-- The backend's service-role client reads today's match quota for the signed-in member.
-- Keep browser roles denied; grant only the server-side role the required read access.
grant select on table public.match_daily_usage to service_role;
