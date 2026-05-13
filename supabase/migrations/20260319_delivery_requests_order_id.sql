ALTER TABLE public.delivery_requests
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id);

CREATE INDEX IF NOT EXISTS delivery_requests_order_id_idx
  ON public.delivery_requests(order_id);
