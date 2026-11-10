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
  const R = 6371e3;
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
 * Calculates Haversine distance in kilometers between two coordinates.
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  return getDistanceMeters(lat1, lon1, lat2, lon2) / 1000;
}

/**
 * Calculates geometric centroid of polygon coordinates.
 */
export function calculatePolygonCenter(polygon = []) {
  if (!polygon || polygon.length === 0) return [25.5788, 83.5780];
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
  if (count === 0) return [25.5788, 83.5780];
  return [sumLat / count, sumLng / count];
}

