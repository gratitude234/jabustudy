CREATE TABLE public.user_push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_push_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT user_push_subscriptions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id)
    ON DELETE CASCADE
);

CREATE INDEX idx_user_push_subscriptions_user_id
  ON public.user_push_subscriptions(user_id);

ALTER TABLE public.user_push_subscriptions
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subscriptions"
  ON public.user_push_subscriptions
  FOR ALL USING (auth.uid() = user_id);
