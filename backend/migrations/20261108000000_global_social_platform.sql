-- MELVO global social platform: adult eligibility and expanded interests.
-- Safe for existing profiles: all current 21–40 ages remain valid.

alter table public.profiles drop constraint if exists profiles_age_chk;
alter table public.profiles
  add constraint profiles_age_chk check (age between 18 and 100) not valid;

alter table public.profiles drop constraint if exists profiles_partner_age_chk;
alter table public.profiles
  alter column min_partner_age set default 18,
  alter column max_partner_age set default 100;

alter table public.profiles drop constraint if exists profiles_values_chk;
alter table public.profiles
  add constraint profiles_values_chk check (cardinality(core_values) <= 5) not valid;

-- Location is now a free-form city / region / country label in the legacy
-- district column. Exact coordinates remain in shake_locations and are private.
comment on column public.profiles.district is
  'User-entered city, region or country label; legacy column name retained for compatibility.';
