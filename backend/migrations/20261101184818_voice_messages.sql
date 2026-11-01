-- Private voice messages for active NIVORA match conversations.
create table if not exists public.voice_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.match_history(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  object_path text not null unique,
  mime_type text not null check (mime_type in ('audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav')),
  size_bytes integer not null check (size_bytes between 1 and 2097152),
  duration_seconds integer not null check (duration_seconds between 1 and 60),
  created_at timestamptz not null default now()
);
create index if not exists voice_messages_match_created_idx
  on public.voice_messages (match_id, created_at);
alter table public.voice_messages enable row level security;
revoke all on table public.voice_messages from public, anon, authenticated;
grant all on table public.voice_messages to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice-messages', 'voice-messages', false, 2097152,
  array['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav']::text[])
on conflict (id) do update set
  public = false,
  file_size_limit = 2097152,
  allowed_mime_types = excluded.allowed_mime_types;
