/**
 * Unit tests for Commissions and Payouts Formulas
 * Run with: node commissions.test.js
 */

import {
  calculateShopShare,
  calculateRiderShare,
  calculatePlatformShare,
  calculateOrderCommission,
  round2,
  DEFAULT_COMMISSION_SETTINGS
} from './commissions.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

function assertEquals(actual, expected, message) {
  const match = typeof expected === 'number' 
    ? Math.abs(actual - expected) < 0.001 
    : actual === expected;
  if (match) {
    console.log(`  ✓ ${message} [Expected: ${expected}, Got: ${actual}]`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message} [Expected: ${expected}, Got: ${actual}]`);
    failed++;
  }
}

console.log('--- TEST SUITE: COMMISSIONS & PAYOUTS FORMULAS ---');

// 1. SHOP COMMISSION TEST (percent = 7%, cap = 20 vs cap = 0)
console.log('\n1. Testing Shop Commission (subtotals: 199, 250, 300, 349, 400)');
// 199 * 7% = 13.93 -> under cap 20 -> 13.93
assertEquals(calculateShopShare(199, { shop_commission_percent: 7, shop_commission_cap: 20 }), 13.93, 'Subtotal 199 (Cap 20)');
// 250 * 7% = 17.50 -> under cap 20 -> 17.50
assertEquals(calculateShopShare(250, { shop_commission_percent: 7, shop_commission_cap: 20 }), 17.50, 'Subtotal 250 (Cap 20)');
// 300 * 7% = 21.00 -> hits cap 20 -> 20.00
assertEquals(calculateShopShare(300, { shop_commission_percent: 7, shop_commission_cap: 20 }), 20.00, 'Subtotal 300 (Cap 20 Capped)');
// 349 * 7% = 24.43 -> hits cap 20 -> 20.00
assertEquals(calculateShopShare(349, { shop_commission_percent: 7, shop_commission_cap: 20 }), 20.00, 'Subtotal 349 (Cap 20 Capped)');
// 400 * 7% = 28.00 -> hits cap 20 -> 20.00
assertEquals(calculateShopShare(400, { shop_commission_percent: 7, shop_commission_cap: 20 }), 20.00, 'Subtotal 400 (Cap 20 Capped)');

// Cap OFF (cap = 0): uncapped percentage
console.log('\n2. Testing Shop Commission with Cap OFF (cap = 0)');
assertEquals(calculateShopShare(300, { shop_commission_percent: 7, shop_commission_cap: 0 }), 21.00, 'Subtotal 300 (Cap OFF)');
assertEquals(calculateShopShare(349, { shop_commission_percent: 7, shop_commission_cap: 0 }), 24.43, 'Subtotal 349 (Cap OFF)');
assertEquals(calculateShopShare(400, { shop_commission_percent: 7, shop_commission_cap: 0 }), 28.00, 'Subtotal 400 (Cap OFF)');

// 2. RIDER COMMISSION PERCENT MODE (percent = 4%, min = 10, max = 20)
console.log('\n3. Testing Rider Commission - Percent Mode (4%, min 10, max 20, distance 0-3km)');
// 199 * 4% = 7.96 -> below min 10 -> 10.00
assertEquals(calculateRiderShare(199, 2.0, false, { rider_commission_mode: 'percent', rider_commission_percent: 4, rider_commission_min: 10, rider_commission_max: 20 }), 10.00, 'Subtotal 199 (Min applied: 10)');
// 250 * 4% = 10.00 -> exactly min 10 -> 10.00
assertEquals(calculateRiderShare(250, 2.0, false, { rider_commission_mode: 'percent', rider_commission_percent: 4, rider_commission_min: 10, rider_commission_max: 20 }), 10.00, 'Subtotal 250 (Hits 10)');
// 300 * 4% = 12.00 -> in range [10, 20] -> 12.00
assertEquals(calculateRiderShare(300, 2.0, false, { rider_commission_mode: 'percent', rider_commission_percent: 4, rider_commission_min: 10, rider_commission_max: 20 }), 12.00, 'Subtotal 300 (4% = 12)');
// 349 * 4% = 13.96 -> in range [10, 20] -> 13.96
assertEquals(calculateRiderShare(349, 2.0, false, { rider_commission_mode: 'percent', rider_commission_percent: 4, rider_commission_min: 10, rider_commission_max: 20 }), 13.96, 'Subtotal 349 (4% = 13.96)');
// 600 * 4% = 24.00 -> exceeds max 20 -> 20.00
assertEquals(calculateRiderShare(600, 2.0, false, { rider_commission_mode: 'percent', rider_commission_percent: 4, rider_commission_min: 10, rider_commission_max: 20 }), 20.00, 'Subtotal 600 (Max applied: 20)');

// 3. RIDER COMMISSION FLAT MODE (flat = 12)
console.log('\n4. Testing Rider Commission - Flat Mode (Flat 12)');
assertEquals(calculateRiderShare(199, 1.5, false, { rider_commission_mode: 'flat', rider_flat_amount: 12 }), 12.00, 'Subtotal 199 Flat mode');
assertEquals(calculateRiderShare(400, 2.5, false, { rider_commission_mode: 'flat', rider_flat_amount: 12 }), 12.00, 'Subtotal 400 Flat mode');

// 4. DISTANCE BANDS (0-3km: +0, 3-6km: +3, 6-8km: +6)
console.log('\n5. Testing Distance Bands');
// 0 - 3 km (e.g. 2.1 km) -> Flat 12 + 0 = 12
assertEquals(calculateRiderShare(250, 2.1, false, { rider_commission_mode: 'flat', rider_flat_amount: 12, rider_distance_addon_3_6km: 3, rider_distance_addon_6_8km: 6 }), 12.00, 'Band 0-3km: no addon');
// 3 - 6 km (e.g. 4.5 km) -> Flat 12 + 3 = 15
assertEquals(calculateRiderShare(250, 4.5, false, { rider_commission_mode: 'flat', rider_flat_amount: 12, rider_distance_addon_3_6km: 3, rider_distance_addon_6_8km: 6 }), 15.00, 'Band 3-6km: +3 addon');
// 6 - 8 km (e.g. 7.2 km) -> Flat 12 + 6 = 18
assertEquals(calculateRiderShare(250, 7.2, false, { rider_commission_mode: 'flat', rider_flat_amount: 12, rider_distance_addon_3_6km: 3, rider_distance_addon_6_8km: 6 }), 18.00, 'Band 6-8km: +6 addon');
// Store pickup -> 0
assertEquals(calculateRiderShare(250, 4.5, true, {}), 0.00, 'Store Pickup: Rider share is 0');

// 5. WHOLESALE COST & PLATFORM SHARE FORMULA
console.log('\n6. Testing Platform Share & Negative Margin Flag');
// subtotal: 300, wholesale_cost: 240, deliveryFee: 20, smallOrderFee: 0, shopShare: 20, riderShare: 15
// platform_share = 300 - 240 + 20 + 0 - 20 - 15 = 45.00
const pShare = calculatePlatformShare({
  subtotal: 300,
  wholesaleCost: 240,
  deliveryFee: 20,
  smallOrderFee: 0,
  shopShare: 20,
  riderShare: 15
});
assertEquals(pShare, 45.00, 'Platform share positive calculation');

// Negative platform share (e.g. wholesale 310 > subtotal 300)
// platform_share = 300 - 310 + 0 - 20 - 15 = -45.00
const negPShare = calculatePlatformShare({
  subtotal: 300,
  wholesaleCost: 310,
  deliveryFee: 0,
  smallOrderFee: 0,
  shopShare: 20,
  riderShare: 15
});
assertEquals(negPShare, -45.00, 'Platform share negative (flagged red)');
assert(negPShare < 0, 'Negative platform share correctly flagged');

// Cost missing
const missingCostPShare = calculatePlatformShare({
  subtotal: 300,
  wholesaleCost: null,
  deliveryFee: 20,
  shopShare: 20,
  riderShare: 15
});
assert(missingCostPShare === null, 'Platform share is null when wholesale cost is missing');

// 6. CANCELLED / REFUNDED ORDER TEST
console.log('\n7. Testing Cancelled / Refunded Order (Void Status)');
const mockRefundedOrder = {
  id: 'ord-test-refund-123',
  status: 'Refunded',
  total: 350,
  items: [{ id: 'p1', name: 'Milk', price: 50, qty: 2 }]
};
const refundCalc = calculateOrderCommission(mockRefundedOrder, new Map());
assertEquals(refundCalc.status, 'void', 'Refunded order status is void');
assertEquals(refundCalc.shop_share, 0, 'Void order shop share is 0');
assertEquals(refundCalc.rider_share, 0, 'Void order rider share is 0');

console.log(`\n========================================`);
console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log(`========================================`);

if (failed > 0) {
  process.exit(1);
}
