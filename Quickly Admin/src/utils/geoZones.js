/**
 * Polygon Geofencing & Smart Rider Dispatch Engine
 * Point-in-Polygon (Ray-Casting Algorithm) & Zone Matching
 */

/**
 * Checks whether a given [lat, lng] point lies inside a polygon.
 * Uses the ray-casting algorithm (Jordan curve theorem) in O(n) time.
 * @param {[number, number]} point - [lat, lng]
 * @param {Array<[number, number]>} polygon - Array of [lat, lng] vertices
 * @returns {boolean}
 */
export function isPointInPolygon(point, polygon) {
  if (!point || !Array.isArray(polygon) || polygon.length < 3) {
    return false;
  }

  const lat = Number(point[0]);
  const lng = Number(point[1]);
  if (isNaN(lat) || isNaN(lng)) return false;

  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const p1 = polygon[i];
    const p2 = polygon[j];

    const xi = Number(p1[0]);
    const yi = Number(p1[1]);
    const xj = Number(p2[0]);
    const yj = Number(p2[1]);

    if (isNaN(xi) || isNaN(yi) || isNaN(xj) || isNaN(yj)) continue;

    // Check if horizontal ray from point intersects polygon segment
    const intersect = ((yi > lng) !== (yj > lng)) &&
      (lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi);

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Finds which active zone contains the specified coordinate.
 * @param {number} lat 
 * @param {number} lng 
 * @param {Array<Object>} zones 
 * @returns {Object|null} The matching zone object or null
 */
export function getZoneForLocation(lat, lng, zones = []) {
  if (lat == null || lng == null || !Array.isArray(zones)) return null;
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (isNaN(nLat) || isNaN(nLng)) return null;

  for (const zone of zones) {
    if (zone.is_active === false) continue;
    if (isPointInPolygon([nLat, nLng], zone.polygon)) {
      return zone;
    }
  }
  return null;
}

/**
 * Calculates Haversine distance in meters between two coordinates.
 */
export function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const toRad = (val) => (val * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Calculates geometric center/centroid of polygon vertices.
 */
export function calculatePolygonCenter(polygon = []) {
  if (!polygon || polygon.length === 0) return [25.6744, 83.4985];
  let sumLat = 0;
  let sumLng = 0;
  let count = 0;

  for (const pt of polygon) {
    const lat = Number(pt[0]);
    const lng = Number(pt[1]);
    if (!isNaN(lat) && !isNaN(lng)) {
      sumLat += lat;
      sumLng += lng;
      count++;
    }
  }

  if (count === 0) return [25.6744, 83.4985];
  return [sumLat / count, sumLng / count];
}

/**
 * Matches and ranks available riders for an incoming order based on:
 * 1. Polygon zone containment (Riders inside the customer's delivery polygon)
 * 2. Dedicated zone assignment (rider_code mapped to zone)
 * 3. Proximity to store / pickup point
 * 4. Workload status (idle vs already delivering)
 * 
 * @param {Object} order - The order with delivery_address { lat, lng }
 * @param {Array<Object>} riders - List of rider status records
 * @param {Array<Object>} zones - List of active delivery zone polygons
 * @param {[number, number]} storeCoords - [storeLat, storeLng]
 * @returns {{ matchedZone: Object|null, rankedRiders: Array<Object>, unzoned: boolean }}
 */
export function rankRidersForOrder(order, riders = [], zones = [], storeCoords = [25.6744, 83.4985]) {
  const addr = order?.delivery_address || {};
  const orderLat = Number(addr.lat);
  const orderLng = Number(addr.lng);

  if (isNaN(orderLat) || isNaN(orderLng)) {
    return { matchedZone: null, rankedRiders: riders, unzoned: true };
  }

  const matchedZone = getZoneForLocation(orderLat, orderLng, zones);

  // If no zone matches, return unzoned fallback with distance to store
  if (!matchedZone) {
    const sorted = [...riders].sort((a, b) => {
      const distA = (a.current_lat && a.current_lng) ? getDistanceMeters(a.current_lat, a.current_lng, storeCoords[0], storeCoords[1]) : 999999;
      const distB = (b.current_lat && b.current_lng) ? getDistanceMeters(b.current_lat, b.current_lng, storeCoords[0], storeCoords[1]) : 999999;
      return distA - distB;
    });
    return { matchedZone: null, rankedRiders: sorted, unzoned: true };
  }

  // Score each rider
  const scoredRiders = riders.map((rider) => {
    let score = 0;
    let reason = [];
    const rLat = Number(rider.current_lat ?? rider.lat);
    const rLng = Number(rider.current_lng ?? rider.lng);
    const hasGPS = !isNaN(rLat) && !isNaN(rLng) && (rLat !== 0 || rLng !== 0);

    // 1. Is rider physically inside this delivery polygon?
    const isInsideZone = hasGPS && isPointInPolygon([rLat, rLng], matchedZone.polygon);
    if (isInsideZone) {
      score += 1000;
      reason.push('Present in delivery zone');
    }

    // 2. Is rider explicitly assigned to this zone?
    const isAssigned = Array.isArray(matchedZone.assigned_riders) && matchedZone.assigned_riders.includes(rider.rider_code);
    if (isAssigned) {
      score += 500;
      reason.push('Assigned to zone');
    }

    // 3. Availability bonus
    if (!rider.active_order_id) {
      score += 200;
      reason.push('Idle (ready now)');
    } else {
      score += 50;
      reason.push('Active on order');
    }

    // 4. Proximity penalty (meters away from store)
    let distToStore = 99999;
    if (hasGPS) {
      distToStore = getDistanceMeters(rLat, rLng, storeCoords[0], storeCoords[1]);
      score -= Math.min(distToStore / 10, 400); // 1 point deducted per 10m up to 400 points
    }

    return {
      ...rider,
      matchScore: score,
      isInsideZone,
      isAssigned,
      distToStoreMeters: distToStore,
      matchReasons: reason
    };
  });

  // Sort descending by match score
  scoredRiders.sort((a, b) => b.matchScore - a.matchScore);

  return {
    matchedZone,
    rankedRiders: scoredRiders,
    unzoned: false
  };
}
