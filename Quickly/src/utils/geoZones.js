/**
 * Polygon Geofencing & Serviceability Engine for Quickly Customer App
 * Jordan Curve Point-in-Polygon (Ray-Casting Algorithm)
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
 * Calculates Haversine distance in kilometers between two coordinates.
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10;
}

/**
 * Calculates Haversine distance in meters between two coordinates.
 */
export function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const km = calculateDistanceKm(lat1, lon1, lat2, lon2);
  return Math.round(km * 1000);
}

/**
 * Calculates geometric centroid of polygon vertices.
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
 * Evaluates whether a customer address is deliverable based on active delivery zones (polygons)
 * with graceful fallback to circular radius if no polygon zones exist.
 * 
 * @param {Object} address - Object with { lat, lng }
 * @param {Object} geofenceConfig - { delivery_zones, store_lat, store_lng, max_delivery_radius_km }
 * @returns {{
 *   isServiceable: boolean,
 *   isOutOfRange: boolean,
 *   matchedZone: Object|null,
 *   deliveryTimeMins: number,
 *   reason: string,
 *   distanceKm: number|null,
 *   usingPolygons: boolean
 * }}
 */
export function checkAddressServiceability(address, geofenceConfig = {}) {
  if (!address) {
    return {
      isServiceable: true,
      isOutOfRange: false,
      matchedZone: null,
      deliveryTimeMins: 15,
      reason: 'Standard Delivery (~15 mins)',
      distanceKm: null,
      usingPolygons: false
    };
  }

  const rawLat = address.lat;
  const rawLng = address.lng;
  const lat = Number(rawLat);
  const lng = Number(rawLng);

  const zones = Array.isArray(geofenceConfig.delivery_zones) 
    ? geofenceConfig.delivery_zones 
    : [];
  const activeZones = zones.filter(z => z.is_active !== false && Array.isArray(z.polygon) && z.polygon.length >= 3);

  // 1. Identify operational polygon zone (for Rider Routing & SLA calculation)
  let matchedZone = null;
  if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0) && activeZones.length > 0) {
    matchedZone = getZoneForLocation(lat, lng, activeZones);
  }

  const deliveryTimeMins = matchedZone?.delivery_time_mins || 15;

  // 2. Hub Distance & Store Radius Validation (default 8.5 km radius)
  const storeLat = Number(geofenceConfig.store_lat) || 25.5788;
  const storeLng = Number(geofenceConfig.store_lng) || 83.5780;
  const maxRadiusKm = Number(geofenceConfig.max_delivery_radius_km) || 8.5;

  let distKm = null;
  if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
    distKm = calculateDistanceKm(storeLat, storeLng, lat, lng);
  }

  // Only block if location is beyond store radius limit (e.g. > 8.5 km from central hub)
  if (distKm !== null && distKm > maxRadiusKm) {
    return {
      isServiceable: false,
      isOutOfRange: true,
      matchedZone,
      deliveryTimeMins,
      distanceKm: distKm,
      reason: `Location is ${distKm} km away (Store delivery limit is ${maxRadiusKm} km)`,
      usingPolygons: false
    };
  }

  return {
    isServiceable: true,
    isOutOfRange: false,
    matchedZone,
    deliveryTimeMins,
    distanceKm: distKm,
    reason: matchedZone ? `Inside ${matchedZone.name}` : (distKm !== null ? `Within delivery radius (${distKm} km)` : 'Within service area'),
    usingPolygons: !!matchedZone
  };
}
