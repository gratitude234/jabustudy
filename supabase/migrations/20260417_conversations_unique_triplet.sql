DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.conversations
    WHERE listing_id IS NOT NULL
    GROUP BY buyer_id, vendor_id, listing_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate conversations exist for buyer_id/vendor_id/listing_id. Resolve duplicates before adding the unique constraint.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.conversations'::regclass
      AND conname = 'conversations_buyer_vendor_listing_key'
  ) THEN
    ALTER TABLE public.conversations
    ADD CONSTRAINT conversations_buyer_vendor_listing_key
    UNIQUE (buyer_id, vendor_id, listing_id);
  END IF;
END $$;
