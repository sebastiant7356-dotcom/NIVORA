-- This index supports auth.users ON DELETE CASCADE checks for consent rows.
create index if not exists shake_reveal_consents_user_idx on public.shake_reveal_consents(user_id, consented_at desc);
