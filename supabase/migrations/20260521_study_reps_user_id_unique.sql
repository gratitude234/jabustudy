ALTER TABLE public.study_reps
  ADD CONSTRAINT study_reps_user_id_key UNIQUE (user_id);
