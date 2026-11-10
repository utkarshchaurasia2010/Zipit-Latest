/**
 * Commissions & Payouts Calculation Engine
 * 
 * Rules & Formulas:
 * 1. shop_share = MIN(shop_commission_cap, subtotal * shop_commission_percent / 100)  [skip cap if cap = 0]
 * 2. rider_share:
 *    percent mode: MIN(rider_commission_max, MAX(rider_commission_min, subtotal * rider_commission_percent / 100))
 *    flat mode: rider_flat_amount
 *    + distance add-on:
 *      0 - 3 km: 0
 *      3 - 6 km: rider_distance_addon_3_6km
 *      6 - 8 km: rider_distance_addon_6_8km
 *    (Store pickup orders have no rider -> rider_share = 0)
 * 3. wholesale_cost = sum of (product cost_price * quantity)
 *    If missing for any item, mark order "cost missing" and platform_share = null.
 * 4. platform_share = subtotal - wholesale_cost + delivery_fee_charged (+ small_order_fee if any) - shop_share - rider_share
 * 5. All monetary calculations rounded to 2 decimal places.
 * 6. Cancelled or refunded orders set commission status = 'void' and excluded from payouts.
 */

export const DEFAULT_COMMISSION_SETTINGS = {
  shop_commission_percent: 7,
  shop_commission_cap: 20,           // 0 = no cap
  rider_commission_mode: 'percent',  // 'percent' | 'flat'
  rider_commission_percent: 4,
  rider_commission_min: 10,
  rider_commission_max: 20,
  rider_flat_amount: 12,
  rider_distance_addon_3_6km: 3,
  rider_distance_addon_6_8km: 6,
  small_order_fee: 35,
  min_order_amount: 199,
  store_lat: 25.5788,
  store_lng: 83.5780
};

export const round2 = (num) => {
  if (num === null || num === undefined || isNaN(num)) return 0;
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
};

/**
 * Calculate distance between dark store and customer address in km
 */
export const calculateDistanceKm = (order, settings = {}) => {
  if (!order) return 0;
  const isPickup = order.delivery_address?.is_pickup || order.delivery_address?.order_type === 'PICKUP';
  if (isPickup) return 0;

  if (typeof order.delivery_address?.distance_km === 'number' && order.delivery_address.distance_km >= 0) {
    return round2(order.delivery_address.distance_km);
  }

  const destLat = Number(order.delivery_address?.lat);
  const destLng = Number(order.delivery_address?.lng);
  const storeLat = Number(settings.store_lat) || DEFAULT_COMMISSION_SETTINGS.store_lat;
  const storeLng = Number(settings.store_lng) || DEFAULT_COMMISSION_SETTINGS.store_lng;

  if (!destLat || !destLng) return 1.5; // Reasonable default for localized hub

  const dLat = (destLat - storeLat) * Math.PI / 180;
  const dLng = (destLng - storeLng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(storeLat * Math.PI / 180) * Math.cos(destLat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(0.1, round2(dist));
};

/**
 * Calculate Shopkeeper Share
 */
export const calculateShopShare = (subtotal, settings = {}) => {
  const percent = Number(settings.shop_commission_percent ?? DEFAULT_COMMISSION_SETTINGS.shop_commission_percent);
  const cap = Number(settings.shop_commission_cap ?? DEFAULT_COMMISSION_SETTINGS.shop_commission_cap);

  const rawShare = (subtotal * percent) / 100;
  if (cap > 0) {
    return round2(Math.min(cap, rawShare));
  }
  return round2(rawShare);
};

/**
 * Calculate Rider Share with distance bands
 */
export const calculateRiderShare = (subtotal, distanceKm = 0, isPickup = false, settings = {}) => {
  if (isPickup) return 0;

  const mode = settings.rider_commission_mode || DEFAULT_COMMISSION_SETTINGS.rider_commission_mode;
  let baseRider = 0;

  if (mode === 'flat') {
    baseRider = Number(settings.rider_flat_amount ?? DEFAULT_COMMISSION_SETTINGS.rider_flat_amount);
  } else {
    // Percent mode
    const percent = Number(settings.rider_commission_percent ?? DEFAULT_COMMISSION_SETTINGS.rider_commission_percent);
    const minAmt = Number(settings.rider_commission_min ?? DEFAULT_COMMISSION_SETTINGS.rider_commission_min);
    const maxAmt = Number(settings.rider_commission_max ?? DEFAULT_COMMISSION_SETTINGS.rider_commission_max);
    const rawShare = (subtotal * percent) / 100;
    baseRider = Math.min(maxAmt, Math.max(minAmt, rawShare));
  }

  // Distance Add-on
  let distanceAddon = 0;
  const addon3_6 = Number(settings.rider_distance_addon_3_6km ?? DEFAULT_COMMISSION_SETTINGS.rider_distance_addon_3_6km);
  const addon6_8 = Number(settings.rider_distance_addon_6_8km ?? DEFAULT_COMMISSION_SETTINGS.rider_distance_addon_6_8km);

  if (distanceKm > 6) {
    distanceAddon = addon6_8;
  } else if (distanceKm > 3) {
    distanceAddon = addon3_6;
  } else {
    distanceAddon = 0;
  }

  return round2(baseRider + distanceAddon);
};

/**
 * Calculate total wholesale cost from order items using products map (or item.cost_price fallback)
 */
export const calculateWholesaleCost = (items = [], productsMap = new Map()) => {
  if (!items || items.length === 0) return { cost: 0, costMissing: false };

  let totalCost = 0;
  let costMissing = false;

  for (const item of items) {
    const qty = Number(item.quantity || item.qty) || 1;
    let costPrice = null;

    // Check item snapshot first
    if (typeof item.cost_price === 'number' && item.cost_price >= 0) {
      costPrice = item.cost_price;
    } else if (productsMap && item.id && productsMap.has(item.id)) {
      const prod = productsMap.get(item.id);
      if (typeof prod?.cost_price === 'number' && prod.cost_price >= 0) {
        costPrice = prod.cost_price;
      }
    }

    if (costPrice === null || costPrice === undefined) {
      costMissing = true;
    } else {
      totalCost += costPrice * qty;
    }
  }

  return {
    cost: costMissing ? null : round2(totalCost),
    costMissing
  };
};

/**
 * Calculate platform share:
 * platform_share = subtotal - wholesale_cost + delivery_fee_charged (+ small_order_fee if any) - shop_share - rider_share
 */
export const calculatePlatformShare = ({ subtotal, wholesaleCost, deliveryFee = 0, smallOrderFee = 0, shopShare = 0, riderShare = 0 }) => {
  if (wholesaleCost === null || wholesaleCost === undefined) {
    return null; // Cost missing
  }
  const net = subtotal - wholesaleCost + Number(deliveryFee || 0) + Number(smallOrderFee || 0) - shopShare - riderShare;
  return round2(net);
};

/**
 * Compute subtotal of order items (excluding delivery & extra fees)
 */
export const calculateOrderSubtotal = (order) => {
  if (!order || !order.items || order.items.length === 0) {
    return round2(Number(order?.total || 0) - Number(order?.delivery_fee || order?.deliveryCharge || 0));
  }
  const itemsSubtotal = order.items.reduce((sum, item) => {
    // Exclude cancelled/refunded substitute items
    if (item.status === 'REFUND_REQUESTED' || item.status === 'REFUNDED_SUBSTITUTE' || item.is_refund_chosen) {
      return sum;
    }
    const price = Number(item.price) || 0;
    const qty = Number(item.quantity || item.qty) || 1;
    return sum + (price * qty);
  }, 0);

  return round2(itemsSubtotal);
};

/**
 * Main idempotency calculation function for a single order
 */
export const calculateOrderCommission = (order, productsMap = new Map(), customSettings = {}) => {
  const settings = { ...DEFAULT_COMMISSION_SETTINGS, ...customSettings };
  const isDelivered = (order.status || '').toLowerCase() === 'delivered';
  const isVoid = ['cancelled', 'refunded', 'cancellation requested', 'refund initiated'].includes((order.status || '').toLowerCase()) ||
                 order.substitution_status === 'CANCELLED' ||
                 order.substitution_status === 'REFUNDED';

  const subtotal = calculateOrderSubtotal(order);
  const isPickup = order.delivery_address?.is_pickup || order.delivery_address?.order_type === 'PICKUP';
  const distanceKm = isPickup ? 0 : calculateDistanceKm(order, settings);

  const deliveryFee = round2(Number(order.delivery_fee || order.deliveryCharge || 0));
  const smallOrderFee = round2(Number(order.small_cart_charge || order.smallCartCharge || (subtotal < settings.min_order_amount && !isPickup ? (order.small_order_fee || 0) : 0)));

  const shopShare = calculateShopShare(subtotal, settings);
  const riderShare = calculateRiderShare(subtotal, distanceKm, isPickup, settings);

  const { cost: wholesaleCost, costMissing } = calculateWholesaleCost(order.items, productsMap);
  const platformShare = calculatePlatformShare({
    subtotal,
    wholesaleCost,
    deliveryFee,
    smallOrderFee,
    shopShare,
    riderShare
  });

  const ratesSnapshot = {
    shop_commission_percent: settings.shop_commission_percent,
    shop_commission_cap: settings.shop_commission_cap,
    rider_commission_mode: settings.rider_commission_mode,
    rider_commission_percent: settings.rider_commission_percent,
    rider_commission_min: settings.rider_commission_min,
    rider_commission_max: settings.rider_commission_max,
    rider_flat_amount: settings.rider_flat_amount,
    rider_distance_addon_3_6km: settings.rider_distance_addon_3_6km,
    rider_distance_addon_6_8km: settings.rider_distance_addon_6_8km,
    distance_km: distanceKm,
    is_pickup: isPickup,
    cost_missing: costMissing
  };

  const status = isVoid ? 'void' : 'pending';

  return {
    order_id: order.id,
    shop_id: order.accepted_by_shopkeeper || null,
    rider_id: isPickup ? null : (order.accepted_by_rider || null),
    subtotal,
    wholesale_cost: wholesaleCost,
    cost_missing: costMissing,
    delivery_fee: deliveryFee,
    small_order_fee: smallOrderFee,
    shop_share: isVoid ? 0 : shopShare,
    rider_share: isVoid ? 0 : riderShare,
    platform_share: isVoid ? 0 : platformShare,
    rates_snapshot: ratesSnapshot,
    status,
    calculated_at: new Date().toISOString()
  };
};
