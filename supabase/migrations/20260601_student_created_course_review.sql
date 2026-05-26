alter table public.study_courses
  add column if not exists course_review_status text not null default 'approved',
  add column if not exists created_from_upload boolean not null default false,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;

alter table public.study_courses
  drop constraint if exists study_courses_course_review_status_check;

alter table public.study_courses
  add constraint study_courses_course_review_status_check
  check (course_review_status in ('pending', 'approved', 'removed'));

update public.study_courses
set course_review_status = 'approved'
where course_review_status is null;

create index if not exists study_courses_review_status_idx
on public.study_courses (course_review_status, department_id, level, created_at desc);
