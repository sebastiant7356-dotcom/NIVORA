-- The consent table is always queried by match_id; its primary-key index already covers that path.
drop index if exists public.shake_reveal_consents_user_idx;
