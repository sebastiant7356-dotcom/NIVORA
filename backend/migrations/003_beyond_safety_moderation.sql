-- BEYOND safety moderation: retain only minimal safety evidence and enforcement records.
-- Report text is limited to a short user-supplied description; normal chats/profiles remain ephemeral.
create table if not exists public.account_enforcements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null check (status in ('active','suspended','banned')),
  reason text not null check (char_length(reason) between 5 and 1000),
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'suspended' or expires_at is null or expires_at > created_at)
);
create table if not exists public.account_appeals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  reason text not null check (char_length(reason) between 5 and 1000),
  status text not null default 'open' check (status in ('open','approved','rejected')),
  resolution text,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists reports_status_created_at_idx on public.reports(status, created_at desc);
create index if not exists reports_reported_id_idx on public.reports(reported_id, created_at desc);
create index if not exists account_appeals_status_created_idx on public.account_appeals(status, created_at desc);
alter table public.account_enforcements enable row level security;
alter table public.account_appeals enable row level security;
revoke all on public.account_enforcements from anon, authenticated;
revoke all on public.account_appeals from anon, authenticated;
grant all on public.account_enforcements to service_role;
grant all on public.account_appeals to service_role;
revoke all on public.reports from anon, authenticated;
grant all on public.reports to service_role;
revoke all on public.audit_log from anon, authenticated;
grant all on public.audit_log to service_role;

-- Scheduled cleanup: report and appeal records older than 90 days; audit events older than 365 days.
create or replace function private.purge_expired_beyond_safety_records()
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  delete from public.reports where created_at < now() - interval '90 days';
  delete from public.account_appeals where created_at < now() - interval '90 days';
  delete from public.audit_log where created_at < now() - interval '365 days';
end;
$$;
revoke all on function private.purge_expired_beyond_safety_records() from public, anon, authenticated, service_role;
select cron.unschedule(jobid) from cron.job where jobname = 'beyond-purge-safety-retention';
select cron.schedule('beyond-purge-safety-retention', '30 2 * * *', 'select private.purge_expired_beyond_safety_records();');
