ALTER TABLE public.riders
  ADD COLUMN IF NOT EXISTS pin_hash text;
