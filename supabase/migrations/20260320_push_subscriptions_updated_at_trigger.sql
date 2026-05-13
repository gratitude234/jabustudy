-- Shared trigger function (skip if already exists from another migration)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- user_push_subscriptions
DROP TRIGGER IF EXISTS trg_user_push_subs_updated_at ON public.user_push_subscriptions;
CREATE TRIGGER trg_user_push_subs_updated_at
  BEFORE UPDATE ON public.user_push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- vendor_push_subscriptions
DROP TRIGGER IF EXISTS trg_vendor_push_subs_updated_at ON public.vendor_push_subscriptions;
CREATE TRIGGER trg_vendor_push_subs_updated_at
  BEFORE UPDATE ON public.vendor_push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- rider_push_subscriptions
DROP TRIGGER IF EXISTS trg_rider_push_subs_updated_at ON public.rider_push_subscriptions;
CREATE TRIGGER trg_rider_push_subs_updated_at
  BEFORE UPDATE ON public.rider_push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
