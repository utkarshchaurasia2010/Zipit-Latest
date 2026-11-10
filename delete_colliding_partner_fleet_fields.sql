-- ==============================================================================
-- Migration: Remove Colliding Partner Fleet Fields
-- ==============================================================================
-- This script removes legacy and colliding partner commission fields:
--   1. shopkeeper_commission_fixed (superseded by shop_commission_percent & shop_commission_cap)
--   2. rider_base_payout (superseded by rider_commission_mode, rider_flat_amount, rider_commission_percent)
--   3. rider_per_km_bonus (superseded by rider_distance_addon_3_6km & rider_distance_addon_6_8km)
--
-- Safe and idempotent execution for Supabase (Postgres).
-- ==============================================================================

-- 1. Clean JSON keys stored inside profiles.address for the system branding record
UPDATE public.profiles
SET address = (
  (address::jsonb) 
  - 'shopkeeper_commission_fixed' 
  - 'rider_base_payout' 
  - 'rider_per_km_bonus'
)::text
WHERE id = '00000000-0000-0000-0000-000000000001'
  AND address IS NOT NULL
  AND address LIKE '{%';

-- 2. Clean JSON keys if any exist in admin_settings or settings tables
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_settings') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'admin_settings' AND column_name = 'settings') THEN
            UPDATE public.admin_settings
            SET settings = (settings::jsonb - 'shopkeeper_commission_fixed' - 'rider_base_payout' - 'rider_per_km_bonus')::text
            WHERE settings IS NOT NULL;
        END IF;
    END IF;
END $$;

-- 3. Drop table columns if they were previously created as standalone table columns
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'shopkeeper_commission_fixed') THEN
        ALTER TABLE public.profiles DROP COLUMN shopkeeper_commission_fixed;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'rider_base_payout') THEN
        ALTER TABLE public.profiles DROP COLUMN rider_base_payout;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'rider_per_km_bonus') THEN
        ALTER TABLE public.profiles DROP COLUMN rider_per_km_bonus;
    END IF;
END $$;
