ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS accepts_delivery boolean NOT NULL DEFAULT true;
