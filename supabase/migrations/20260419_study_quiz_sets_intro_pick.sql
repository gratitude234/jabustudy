-- is_intro_pick — marks a quiz set as a suitable starter for new students in that dept/level
alter table public.study_quiz_sets
  add column if not exists is_intro_pick boolean not null default false;

create index if not exists study_quiz_sets_intro_pick_idx
  on public.study_quiz_sets (is_intro_pick)
  where is_intro_pick = true;
