ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS pause_until timestamptz,
  ADD COLUMN IF NOT EXISTS pause_reason text;
