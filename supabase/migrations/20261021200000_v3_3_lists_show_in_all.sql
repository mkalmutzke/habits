-- Version 3.3: choose which lists are part of "All" (owner R3).
-- Existing lists stay in All (owner Q6). Additive: the live 3.2
-- app neither reads nor writes the column.
alter table public.todo_lists
  add column show_in_all boolean not null default true;
comment on column public.todo_lists.show_in_all is 'v3.3: false = the list''s tasks are left out of the combined "All" view.';
