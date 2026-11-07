-- Support moderator/report lookups and FK cascades on anonymous post authors.
-- Additive and safe to apply to the existing global social schema.
create index if not exists anonymous_posts_author_id_idx
  on public.anonymous_posts(author_id);
