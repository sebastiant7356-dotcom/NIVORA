-- Remove the redundant legacy audience CHECK left by the initial table definition.
-- The canonical constraint now permits only global and radius audiences.
alter table public.anonymous_posts drop constraint if exists anonymous_posts_check;
