-- Add user_id to riders so they can have proper auth accounts
ALTER TABLE public.riders
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

CREATE UNIQUE INDEX IF NOT EXISTS riders_user_id_unique
  ON public.riders (user_id)
  WHERE user_id IS NOT NULL;

-- Push subscription table for riders (same pattern as vendor_push_subscriptions)
CREATE TABLE IF NOT EXISTS public.rider_push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rider_push_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT rider_push_subscriptions_rider_id_fkey
    FOREIGN KEY (rider_id) REFERENCES public.riders(id)
);

-- Notifications for riders reuse the existing notifications table
-- (notifications.user_id references auth.users, which riders will now have)

-- RLS: riders can read their own push subscriptions
ALTER TABLE public.rider_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "riders can manage own push subscriptions"
  ON public.rider_push_subscriptions
  FOR ALL
  USING (
    rider_id IN (
      SELECT id FROM public.riders WHERE user_id = auth.uid()
    )
  );
