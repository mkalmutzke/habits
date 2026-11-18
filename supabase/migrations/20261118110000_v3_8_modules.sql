-- Version 3.8, step 18: modules can be shown or hidden (owner, 18 Nov 2026),
-- so every user decides what the app shows. Settings → Modules.
--   ibkr_display:   'section' (the IBKR card on What's up?) or 'off'
--   garmin_display: 'icon' (icon in the header + window, as in v3.6),
--                   'section' (a card on What's up?) or 'off'
-- The defaults are what the app shows today, so nothing changes until a
-- switch is used. Hiding only changes the screen; the data keeps being fetched.
-- Additive only (rollback-safe).

alter table public.user_settings
  add column ibkr_display text not null default 'section' check (ibkr_display in ('off', 'section')),
  add column garmin_display text not null default 'icon' check (garmin_display in ('off', 'icon', 'section'));
comment on column public.user_settings.ibkr_display is 'v3.8: IBKR card on What''s up? (section) or hidden (off).';
comment on column public.user_settings.garmin_display is 'v3.8: Garmin as header icon + window (icon), a card on What''s up? (section), or hidden (off).';
