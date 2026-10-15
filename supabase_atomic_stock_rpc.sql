-- =========================================================================
-- ATOMIC INVENTORY DECREMENT & VALIDATION RPC FOR ZIPIT E-COMMERCE
-- Prevents simultaneous race conditions when the last item in stock is purchased.
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- =========================================================================

-- 1. Atomic Single Product Decrement
CREATE OR REPLACE FUNCTION decrement_product_stock(
  p_product_id UUID,
  p_quantity INT
) RETURNS JSONB AS $$
DECLARE
  v_current_stock INT;
  v_new_stock INT;
BEGIN
  -- Row lock product to prevent simultaneous read/write race condition
  SELECT stock_count INTO v_current_stock 
  FROM products 
  WHERE id = p_product_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product not found');
  END IF;

  -- Check if stock is managed and sufficient
  IF v_current_stock IS NOT NULL AND v_current_stock < p_quantity THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Insufficient stock', 
      'available_stock', v_current_stock
    );
  END IF;

  -- Deduct atomically
  IF v_current_stock IS NOT NULL THEN
    v_new_stock := GREATEST(0, v_current_stock - p_quantity);
    UPDATE products 
    SET 
      stock_count = v_new_stock,
      is_out_of_stock = (v_new_stock = 0)
    WHERE id = p_product_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'remaining_stock', v_new_stock);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Multi-Item All-or-Nothing Order Validation RPC
CREATE OR REPLACE FUNCTION place_order_with_atomic_stock(
  p_profile_id UUID,
  p_items JSONB,
  p_total NUMERIC,
  p_delivery_address JSONB,
  p_payment_method TEXT,
  p_status TEXT,
  p_delivery_charge NUMERIC,
  p_small_cart_charge NUMERIC,
  p_applied_coupon TEXT,
  p_discount_amount NUMERIC,
  p_delivery_otp TEXT
) RETURNS JSONB AS $$
DECLARE
  v_item JSONB;
  v_prod_id UUID;
  v_qty INT;
  v_stock INT;
  v_order_id UUID;
  v_order_record RECORD;
BEGIN
  -- Phase 1: Lock and verify ALL items have enough stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_prod_id := (v_item->>'id')::UUID;
    v_qty := GREATEST(1, COALESCE((v_item->>'qty')::INT, (v_item->>'quantity')::INT, 1));

    SELECT stock_count INTO v_stock
    FROM products
    WHERE id = v_prod_id
    FOR UPDATE;

    IF v_stock IS NOT NULL AND v_stock < v_qty THEN
      -- Immediate rollback and reject: no partial orders
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Item "' || COALESCE(v_item->>'name', 'Product') || '" just went out of stock! Available: ' || v_stock
      );
    END IF;
  END LOOP;

  -- Phase 2: Deduct stock for all items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_prod_id := (v_item->>'id')::UUID;
    v_qty := GREATEST(1, COALESCE((v_item->>'qty')::INT, (v_item->>'quantity')::INT, 1));

    UPDATE products
    SET 
      stock_count = GREATEST(0, COALESCE(stock_count, 100) - v_qty),
      is_out_of_stock = (GREATEST(0, COALESCE(stock_count, 100) - v_qty) = 0)
    WHERE id = v_prod_id;
  END LOOP;

  -- Phase 3: Create the order
  INSERT INTO orders (
    profile_id,
    items,
    total,
    delivery_address,
    payment_method,
    status,
    delivery_charge,
    small_cart_charge,
    applied_coupon,
    discount_amount,
    delivery_otp
  ) VALUES (
    p_profile_id,
    p_items,
    p_total,
    p_delivery_address,
    p_payment_method,
    p_status,
    p_delivery_charge,
    p_small_cart_charge,
    p_applied_coupon,
    p_discount_amount,
    p_delivery_otp
  ) RETURNING * INTO v_order_record;

  RETURN jsonb_build_object(
    'success', true,
    'order', row_to_json(v_order_record)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
