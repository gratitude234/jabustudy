CREATE OR REPLACE FUNCTION decrement_item_stock(p_item_id uuid, p_qty int)
RETURNS void AS $$
  UPDATE vendor_menu_items
  SET
    stock_count = GREATEST(0, stock_count - p_qty),
    active = CASE
      WHEN GREATEST(0, stock_count - p_qty) = 0 THEN false
      ELSE active
    END
  WHERE id = p_item_id AND stock_count IS NOT NULL;
$$ LANGUAGE sql;
