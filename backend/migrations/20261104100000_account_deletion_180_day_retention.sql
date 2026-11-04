-- Preserve only the minimum account-registration record for 180 days after cancellation.
-- Profile, conversations, photos and voice files continue to be deleted by the account route.
create table if not exists public.account_deletion_retention (
  id bigint generated always as identity primary key,
  auth_user_id uuid not null unique,
  registration_email text,
  registration_display_name text,
  registration_provider text,
  registered_at timestamptz,
  cancelled_at timestamptz not null default now(),
  purge_after timestamptz not null,
  created_at timestamptz not null default now(),
  constraint account_deletion_retention_window_chk
    check (purge_after = cancelled_at + interval '180 days')
);

create index if not exists account_deletion_retention_purge_idx
  on public.account_deletion_retention (purge_after);

alter table public.account_deletion_retention enable row level security;
revoke all on table public.account_deletion_retention from public, anon, authenticated;
grant select, insert, update, delete on table public.account_deletion_retention to service_role;
grant usage, select on sequence public.account_deletion_retention_id_seq to service_role;

create or replace function private.purge_expired_account_registration_records()
returns integer
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare deleted_count integer;
begin
  delete from public.account_deletion_retention
   where purge_after <= now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function private.purge_expired_account_registration_records() from public, anon, authenticated;
grant execute on function private.purge_expired_account_registration_records() to postgres;

-- Supabase-managed pg_cron: daily UTC purge, no extra Render service.
create extension if not exists pg_cron with schema pg_catalog;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job
    from cron.job
   where jobname = 'nivora-purge-account-registration-retention'
   limit 1;
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
  perform cron.schedule(
    'nivora-purge-account-registration-retention',
    '15 2 * * *',
    'select private.purge_expired_account_registration_records();'
  );
end;
$$;
