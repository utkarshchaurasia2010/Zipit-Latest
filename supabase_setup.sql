-- =========================================================================
-- ZIPIT SUPABASE SETUP: EXTENSIONS, RLS POLICIES & ORDER CLAIM FUNCTION
-- =========================================================================

-- 1. Enable extension for fast text search and trigram matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Ensure Row Level Security (RLS) is active
ALTER TABLE IF EXISTS access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Allow reading active shopkeepers for assignment dropdown
DROP POLICY IF EXISTS "Allow reading active shopkeepers for assignment" ON access_codes;
CREATE POLICY "Allow reading active shopkeepers for assignment"
ON access_codes
FOR SELECT
USING (role = 'shopkeeper');

-- 4. Atomic claim function with tag eligibility check
CREATE OR REPLACE FUNCTION claim_shopkeeper_order(
  p_order_id UUID,
  p_shopkeeper_code TEXT
) RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_item JSONB;
  v_raw_name TEXT;
  v_allowed_codes TEXT[];
  v_clean_code TEXT := UPPER(TRIM(p_shopkeeper_code));
BEGIN
  -- Row-lock order
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- If already claimed by another shopkeeper, reject
  IF v_order.accepted_by_shopkeeper IS NOT NULL AND UPPER(TRIM(v_order.accepted_by_shopkeeper)) != v_clean_code THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order was already accepted by another shopkeeper');
  END IF;

  -- Inspect order items for shopkeeper tag restrictions (---SHOPKEEPERS:SK01, SK02---)
  IF v_order.items IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items) LOOP
      v_raw_name := COALESCE(v_item->>'name', '');
      
      -- Extract shopkeeper tags
      IF v_raw_name LIKE '%---SHOPKEEPERS:%---%' THEN
        v_allowed_codes := regexp_split_to_array(
          regexp_replace(v_raw_name, '.*---SHOPKEEPERS:(.*?)---.*', '\1'),
          '\s*,\s*'
        );
        
        -- Check if current shopkeeper code is permitted
        IF array_length(v_allowed_codes, 1) > 0 AND NOT (v_clean_code = ANY(v_allowed_codes)) THEN
          RETURN jsonb_build_object(
            'success', false, 
            'error', 'Shopkeeper ' || v_clean_code || ' is not authorized to fulfill product: ' || COALESCE(v_item->>'name', 'Item')
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Update order status and claim
  UPDATE orders
  SET 
    accepted_by_shopkeeper = v_clean_code,
    status = CASE WHEN status IN ('Placed', 'Payment Pending') THEN 'Preparing' ELSE status END
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'claimed_by', v_clean_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Fast GIN index for search on product tags & names
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
