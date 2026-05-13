-- Payment fields on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method text
    CHECK (payment_method IN ('transfer', 'cash')),
  ADD COLUMN IF NOT EXISTS payment_status text
    NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN (
      'unpaid', 'buyer_confirmed', 'vendor_confirmed'
    )),
  ADD COLUMN IF NOT EXISTS receipt_url text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_note text;

-- Account details on vendors
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_account_name text;
