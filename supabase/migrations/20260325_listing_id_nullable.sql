-- Fix: delivery_requests.listing_id must be nullable so that food delivery
-- orders (which have no listing) can create a delivery_request row.
-- Without this, every food delivery order silently fails to create a
-- delivery_request — the entire food delivery loop is dead.

ALTER TABLE public.delivery_requests
  ALTER COLUMN listing_id DROP NOT NULL;
