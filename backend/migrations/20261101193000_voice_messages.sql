-- Private voice messages for active NIVORA chats.
-- Objects are accessible only through the authenticated backend, which checks match membership.
alter table public.messages
  add column if not exists message_type text not null default 'text',
  add column if not exists voice_object_path text,
  add column if not exists voice_duration_seconds smallint;

alter table public.messages
  drop constraint if exists messages_message_type_check;
alter table public.messages
  add constraint messages_message_type_check
  check (message_type in ('text','voice'));

alter table public.messages
  drop constraint if exists messages_voice_metadata_check;
alter table public.messages
  add constraint messages_voice_metadata_check
  check (
    (message_type = 'text' and voice_object_path is null and voice_duration_seconds is null)
    or
    (message_type = 'voice' and voice_object_path is not null
      and voice_duration_seconds between 1 and 60)
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('nivora-voice', 'nivora-voice', false, 2097152,
        array['audio/webm','audio/ogg','audio/mp4'])
on conflict (id) do update
set public = false, file_size_limit = 2097152,
    allowed_mime_types = excluded.allowed_mime_types;

-- No browser-role policies are created for this bucket. Backend service-role
-- operations are gated by assertChatMatch() on every upload and message read.
