export const RWANDA_CENTER = [-1.9403, 29.8739];
export const DEFAULT_ZOOM = 8;
export const FOUND_ZOOM = 17;
export const GEOLOCATION_OPTIONS = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };
// A reading closer than this to the last geocoded point keeps its address.
export const REGEOCODE_DISTANCE_M = 25;
export const MIN_GEOCODE_GAP_MS = 3000;

export const GEO_DETAIL_ROWS = [
  { key: "latitude", labelKey: "DCS_GEO_LATITUDE_LABEL" },
  { key: "longitude", labelKey: "DCS_GEO_LONGITUDE_LABEL" },
  { key: "accuracy", labelKey: "DCS_GEO_ACCURACY_LABEL", is_accuracy: true },
  { key: "province", labelKey: "DCS_GEO_PROVINCE_LABEL" },
  { key: "district", labelKey: "DCS_GEO_DISTRICT_LABEL" },
  { key: "sector", labelKey: "DCS_GEO_SECTOR_LABEL" },
  { key: "cell", labelKey: "DCS_GEO_CELL_LABEL" },
  { key: "village", labelKey: "DCS_GEO_VILLAGE_LABEL" },
  { key: "street", labelKey: "DCS_GEO_STREET_LABEL" },
  { key: "full_address", labelKey: "DCS_GEO_FULL_ADDRESS_LABEL", full_width: true },
];

/**
 * Every geolocation answer carries the fixed __map__location__data marker
 * so raw stored data can be told apart from any other object-shaped answer.
 */
export function build_geo_value(overrides) {
  return Object.assign(
    {
      __map__location__data: true,
      latitude: null,
      longitude: null,
      accuracy: null,
      province: null,
      district: null,
      sector: null,
      cell: null,
      village: null,
      street: null,
      full_address: null,
      is_manual: false,
    },
    overrides,
  );
}

/** True when the stored coordinates are a real reading, not the (0, 0) "unavailable" sentinel. */
export function has_real_coordinates(details) {
  return !!details && details.latitude != null && details.longitude != null && !(details.latitude === 0 && details.longitude === 0);
}

/** Great-circle distance in metres between two points. */
export function distance_meters(lat_a, lng_a, lat_b, lng_b) {
  const to_rad = (degrees) => (degrees * Math.PI) / 180;
  const earth_radius = 6371000;
  const d_lat = to_rad(lat_b - lat_a);
  const d_lng = to_rad(lng_b - lng_a);
  const a = Math.sin(d_lat / 2) ** 2 + Math.cos(to_rad(lat_a)) * Math.cos(to_rad(lat_b)) * Math.sin(d_lng / 2) ** 2;
  return 2 * earth_radius * Math.asin(Math.sqrt(a));
}

/**
 * Whether an incoming device reading should replace the stored one: never
 * over a place the respondent searched for; always when nothing real is
 * stored yet; otherwise only when its accuracy radius is smaller (better)
 * than the stored one - a worse fix is ignored.
 */
export function is_better_reading(details, accuracy) {
  if (!details) return true;
  if (details.is_manual && has_real_coordinates(details)) return false;
  if (!has_real_coordinates(details)) return true;
  if (details.accuracy == null) return true;
  if (accuracy == null) return false;
  return accuracy < details.accuracy;
}

/**
 * Reverse-geocodes coordinates into Rwanda's administrative levels via the
 * public Nominatim API - OpenStreetMap area names vary by region, so each
 * level tries a couple of plausible OSM address keys before giving up.
 */
export async function reverse_geocode(latitude, longitude) {
  const url =
    "https://nominatim.openstreetmap.org/reverse?format=json" +
    `&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&addressdetails=1`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("reverse_geocode_failed");
  const data = await response.json();
  const address = data.address || {};
  return {
    province: address.state || address.region || address.province || null,
    district: address.city_district || address.district || address.county || null,
    sector: address.sector || address.municipality || address.suburb || null,
    cell: address.cell || address.neighbourhood || address.quarter || null,
    village: address.village || address.hamlet || address.locality || null,
    street: address.road || address.street || address.pedestrian || address.footway || address.path || null,
    full_address: data.display_name || null,
  };
}

/**
 * Forward-geocodes free text into coordinates, restricted to Rwanda.
 */
export async function forward_geocode(query) {
  const url =
    "https://nominatim.openstreetmap.org/search?format=json" +
    `&q=${encodeURIComponent(query)}&addressdetails=1&limit=1&countrycodes=rw`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("search_failed");
  const results = await response.json();
  if (!results || results.length === 0) return null;
  return { latitude: parseFloat(results[0].lat), longitude: parseFloat(results[0].lon) };
}
