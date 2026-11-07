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
create index if not exists reports_status_created_at_idx on public.reports(status, created_at desc);
create index if not exists reports_reported_id_idx on public.reports(reported_id, created_at desc);
alter table public.account_enforcements enable row level security;
revoke all on public.account_enforcements from anon, authenticated;
grant all on public.account_enforcements to service_role;
revoke all on public.reports from anon, authenticated;
grant all on public.reports to service_role;
revoke all on public.audit_log from anon, authenticated;
grant all on public.audit_log to service_role;
