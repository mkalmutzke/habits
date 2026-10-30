-- Version 3.1: an optional subtitle per habit – a second line in the habit
-- grid (owner, change note 05 #3a). Additive.
alter table public.habits
  add column subtitle text not null default '' check (char_length(subtitle) <= 60);
comment on column public.habits.subtitle is 'v3.1: optional second line under the title (0–60 characters).';
