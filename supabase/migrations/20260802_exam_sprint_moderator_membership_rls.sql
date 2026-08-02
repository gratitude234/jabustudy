-- Allow exam RLS policies to recognize the signed-in moderator.
-- Only a user's own membership row is visible; no other admin/rep records are exposed.

begin;

drop policy if exists "study_admins_read_own_membership" on public.study_admins;
create policy "study_admins_read_own_membership"
on public.study_admins
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "study_reps_read_own_membership" on public.study_reps;
create policy "study_reps_read_own_membership"
on public.study_reps
for select
to authenticated
using (user_id = auth.uid());

commit;
