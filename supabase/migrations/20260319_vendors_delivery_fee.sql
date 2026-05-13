ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS delivery_fee integer NOT NULL DEFAULT 0;
