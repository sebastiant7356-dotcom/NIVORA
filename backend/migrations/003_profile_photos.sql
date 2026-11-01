-- NIVORA 003: private profile photo storage and staff moderation.
-- Apply only after reviewing against the target project. No existing tables are dropped.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  object_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  sort_order integer not null default 0 check (sort_order between 0 and 3),
  approval_status text not null default 'pending'
    check (approval_status in ('pending','approved','rejected')),
  review_reason text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, sort_order)
);

create index if not exists profile_photos_user_status_idx
  on public.profile_photos (user_id, approval_status, sort_order);

alter table public.profile_photos enable row level security;
revoke all on public.profile_photos from anon, authenticated;
grant all on public.profile_photos to service_role;

-- The bucket is private. Upload, signed-URL creation and deletion happen only
-- through the authenticated backend using its server-side service key.
