-- vendor_push_subscriptions
CREATE TABLE IF NOT EXISTS public.vendor_push_subscriptions (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  vendor_id  uuid NOT NULL,
  endpoint   text NOT NULL UNIQUE,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vendor_push_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT vendor_push_subscriptions_vendor_id_fkey
    FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vendor_push_subscriptions_vendor_id
  ON public.vendor_push_subscriptions(vendor_id);

ALTER TABLE public.vendor_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors manage own push subscriptions"
  ON public.vendor_push_subscriptions
  FOR ALL USING (
    vendor_id IN (
      SELECT id FROM public.vendors WHERE user_id = auth.uid()
    )
  );

-- rider_push_subscriptions
CREATE TABLE IF NOT EXISTS public.rider_push_subscriptions (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  rider_id   uuid NOT NULL,
  endpoint   text NOT NULL UNIQUE,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rider_push_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT rider_push_subscriptions_rider_id_fkey
    FOREIGN KEY (rider_id) REFERENCES public.riders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rider_push_subscriptions_rider_id
  ON public.rider_push_subscriptions(rider_id);

ALTER TABLE public.rider_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Riders manage own push subscriptions"
  ON public.rider_push_subscriptions
  FOR ALL USING (
    rider_id IN (
      SELECT id FROM public.riders WHERE user_id = auth.uid()
    )
  );
