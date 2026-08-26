import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { get_field_text } from "./fieldText.js";

// Leaflet's default marker image URLs assume a plain <script> tag setup and
// resolve to nothing under a bundler - pointing them at the actual bundled
// asset URLs is required or every marker renders as a broken image icon.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

const RWANDA_CENTER = [-1.9403, 29.8739];
const DEFAULT_ZOOM = 8;
const FOUND_ZOOM = 17;
const GEOLOCATION_OPTIONS = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };
const REFRESH_INTERVAL_MS = 10000;

const GEO_DETAIL_ROWS = [
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

function build_geo_value(overrides) {
  return Object.assign(
    {
      // A fixed, unambiguous marker every geolocation answer carries -
      // never toggled per-instance - so any code inspecting a submission's
      // raw stored data (a generic export, a DB tool, a future field type
      // that also happens to store a plain object) can tell a geolocation
      // answer apart from anything else on sight, with no risk of
      // confusing it for some other object-shaped answer.
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

/**
 * Reverse-geocodes coordinates into Rwanda's administrative levels via the
 * public Nominatim API - OpenStreetMap area names vary by region, so each
 * level tries a couple of plausible OSM address keys before giving up.
 */
async function reverse_geocode(latitude, longitude) {
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
async function forward_geocode(query) {
  const url =
    "https://nominatim.openstreetmap.org/search?format=json" +
    `&q=${encodeURIComponent(query)}&addressdetails=1&limit=1&countrycodes=rw`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("search_failed");
  const results = await response.json();
  if (!results || results.length === 0) return null;
  return { latitude: parseFloat(results[0].lat), longitude: parseFloat(results[0].lon) };
}

/**
 * GeoLocation field: search a place by name or auto-detect the
 * respondent's position, drop a pin on a map, and show the full breakdown
 * of Rwandan administrative levels. Coordinates only ever come from the
 * device's own location detection (never typed) and fall back to (0, 0)
 * when detection is unavailable; the address-detail fields simply read
 * "Not available" when reverse geocoding could not run (offline) or found
 * nothing for a given level - there is no manual-entry override for any of
 * it right now. Unlike every other data field this one carries no question
 * label of its own (matches paragraph/file) since its own section title
 * and sections already explain themselves.
 */
export default function GeolocationField({ field, language, mode, value, onChange, error, ruleValidMessage }) {
  const { translate } = useDcsLanguage();
  const is_builder = mode === "builder";
  const help_text = get_field_text(field.help_text, language);
  const details = value || build_geo_value();
  const has_value = details.latitude != null && details.longitude != null;

  const [status, setStatus] = useState(null);
  const [search_text, setSearchText] = useState("");
  const [is_online, setIsOnline] = useState(window.navigator.onLine);

  const map_container_ref = useRef(null);
  const map_ref = useRef(null);
  const marker_ref = useRef(null);
  const auto_requested_ref = useRef(false);

  // The 'online'/'offline' events only fire on an actual network interface
  // transition, which some browsers miss (e.g. wifi still connected but no
  // internet) - polling navigator.onLine directly (same interval as the
  // location refresh below) keeps this accurate even when no event fires.
  useEffect(() => {
    const sync_online_state = () => setIsOnline(window.navigator.onLine);
    window.addEventListener("online", sync_online_state);
    window.addEventListener("offline", sync_online_state);
    const poll_interval_id = window.setInterval(sync_online_state, REFRESH_INTERVAL_MS);
    return () => {
      window.removeEventListener("online", sync_online_state);
      window.removeEventListener("offline", sync_online_state);
      window.clearInterval(poll_interval_id);
    };
  }, []);

  // The map (and its tile layer) is only ever created while online and
  // actually shown - going offline unmounts the container div entirely
  // (see the render below), so this tears the Leaflet instance down and,
  // once back online, builds a brand new one against the fresh container
  // rather than trying to resurrect one still holding failed/blank tiles
  // from before the connection dropped.
  useEffect(() => {
    if (is_builder || !is_online || !map_container_ref.current || map_ref.current) return;
    const map = L.map(map_container_ref.current).setView(RWANDA_CENTER, DEFAULT_ZOOM);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    map_ref.current = map;
    return () => {
      map.remove();
      map_ref.current = null;
      marker_ref.current = null;
    };
  }, [is_builder, is_online]);

  useEffect(() => {
    const map = map_ref.current;
    if (!map || !has_value) return;
    // (0, 0) is this field's own "detection unavailable" sentinel, never a
    // real reading - jumping the map there at high zoom would be
    // meaningless and misleading, so it is simply left showing Rwanda.
    if (details.latitude === 0 && details.longitude === 0) return;
    if (marker_ref.current) map.removeLayer(marker_ref.current);
    map.setView([details.latitude, details.longitude], FOUND_ZOOM);
    marker_ref.current = L.marker([details.latitude, details.longitude]).addTo(map);
    // is_online is included so the marker is re-added onto the brand new
    // map instance created above the moment connectivity comes back, even
    // when the coordinates themselves haven't changed at all.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is_online, has_value, details.latitude, details.longitude]);

  const apply_coordinates = async (latitude, longitude, accuracy, is_silent) => {
    if (!window.navigator.onLine) {
      // Offline: coordinates still come straight from the device, but
      // reverse geocoding needs a network call that would just fail - skip
      // it outright and leave every address field "Not available" rather
      // than firing (and failing) a doomed fetch.
      onChange(build_geo_value({ latitude, longitude, accuracy }));
      if (!is_silent) setStatus({ type: "success", message: translate("DCS_GEO_STATUS_OFFLINE_SAVED") });
      return;
    }
    if (!is_silent) setStatus({ type: "loading", message: translate("DCS_GEO_STATUS_LOOKING_UP_ADDRESS") });
    try {
      const address = await reverse_geocode(latitude, longitude);
      onChange(build_geo_value(Object.assign({ latitude, longitude, accuracy }, address)));
      if (!is_silent) setStatus({ type: "success", message: translate("DCS_GEO_STATUS_FOUND") });
    } catch (reverse_error) {
      onChange(build_geo_value({ latitude, longitude, accuracy }));
      if (!is_silent) setStatus({ type: "error", message: translate("DCS_GEO_STATUS_ADDRESS_FAILED") });
    }
  };

  // Keeps the answer (and the map/marker) current on its own every few
  // seconds - most importantly, the moment connectivity comes back after a
  // stretch offline, since nothing else would otherwise prompt a fresh
  // reverse-geocode of whatever coordinates were last captured. Runs
  // quietly: never touches the status line, and any failure (permission
  // still denied, GPS momentarily unavailable) is simply ignored rather
  // than clobbering a perfectly good existing reading.
  const silent_refresh = () => {
    if (!window.navigator.geolocation) return;
    window.navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        apply_coordinates(latitude, longitude, accuracy, true);
      },
      () => {},
      GEOLOCATION_OPTIONS,
    );
  };

  useEffect(() => {
    if (is_builder) return;
    const interval_id = window.setInterval(silent_refresh, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is_builder]);

  // Coordinates may only ever come from the device's own location
  // detection - never typed - so a failed/unavailable reading still needs
  // a stored value rather than leaving the answer blank forever: (0, 0)
  // is that sentinel. Never overwrites an already-captured real reading
  // (e.g. a transient timeout on a retry).
  const apply_failed_detection = () => {
    if (has_value) return;
    onChange(build_geo_value({ latitude: 0, longitude: 0 }));
  };

  const handle_detect = () => {
    if (!window.navigator.geolocation) {
      setStatus({ type: "error", message: translate("DCS_GEO_STATUS_NOT_SUPPORTED") });
      apply_failed_detection();
      return;
    }
    setStatus({ type: "loading", message: translate("DCS_GEO_STATUS_DETECTING") });
    window.navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        apply_coordinates(latitude, longitude, accuracy);
      },
      (geo_error) => {
        const is_permission_denied = geo_error.code === geo_error.PERMISSION_DENIED;
        const message_by_code = {
          [geo_error.PERMISSION_DENIED]: translate("DCS_GEO_STATUS_PERMISSION_DENIED"),
          [geo_error.POSITION_UNAVAILABLE]: translate("DCS_GEO_STATUS_UNAVAILABLE"),
          [geo_error.TIMEOUT]: translate("DCS_GEO_STATUS_TIMEOUT"),
        };
        setStatus({
          type: "error",
          message: message_by_code[geo_error.code] || translate("DCS_GEO_STATUS_UNKNOWN_ERROR"),
          show_guide: is_permission_denied,
        });
        apply_failed_detection();
      },
      GEOLOCATION_OPTIONS,
    );
  };

  useEffect(() => {
    if (is_builder || auto_requested_ref.current || has_value) return;
    auto_requested_ref.current = true;
    handle_detect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is_builder]);

  const handle_search = async () => {
    const query = search_text.trim();
    if (!query) {
      setStatus({ type: "error", message: translate("DCS_GEO_STATUS_SEARCH_EMPTY") });
      return;
    }
    if (!window.navigator.onLine) {
      setStatus({ type: "error", message: translate("DCS_GEO_STATUS_OFFLINE_SEARCH_UNAVAILABLE") });
      return;
    }
    setStatus({ type: "loading", message: translate("DCS_GEO_STATUS_SEARCHING") });
    try {
      const found = await forward_geocode(query);
      if (!found) {
        setStatus({ type: "error", message: translate("DCS_GEO_STATUS_SEARCH_NOT_FOUND") });
        return;
      }
      await apply_coordinates(found.latitude, found.longitude, null);
    } catch (search_error) {
      setStatus({ type: "error", message: translate("DCS_GEO_STATUS_SEARCH_FAILED") });
    }
  };

  const format_accuracy = (accuracy_meters) =>
    accuracy_meters == null ? translate("DCS_GEO_NOT_AVAILABLE") : translate("DCS_GEO_ACCURACY_METERS", { value: Math.round(accuracy_meters) });

  return (
    <div className="dcs-geo-section w-full" style={{ border: "1px solid #E0E0E0", borderRadius: 14, padding: "1rem" }}>
      <p className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: "#056daa" }}>
        {translate("DCS_GEO_SECTION_TITLE")}
        {field.mandatory && <span style={{ color: "#E74C3C" }}> *</span>}
      </p>
      {help_text && (
        <p className="text-xs mb-2" style={{ color: "#9E9E9E" }}>
          {help_text}
        </p>
      )}

      <div className="flex items-stretch gap-2 mb-2">
        <div className="relative flex-1" style={{ minWidth: 0 }}>
          <input
            type="text"
            className="cok-auth-input w-full py-3"
            style={{ paddingRight: 40 }}
            placeholder={translate("DCS_GEO_SEARCH_PLACEHOLDER")}
            value={search_text}
            disabled={is_builder}
            onChange={(event) => setSearchText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handle_search();
              }
            }}
          />
          <button
            type="button"
            onClick={handle_search}
            disabled={is_builder}
            aria-label={translate("DCS_GEO_SEARCH_BUTTON")}
            title={translate("DCS_GEO_SEARCH_BUTTON")}
            className="dcs-geo-icon-button flex items-center justify-center cursor-pointer"
            style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", width: 32, height: 32, border: "none", borderRadius: "50%", background: "transparent" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#056daa" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>
        <button
          type="button"
          onClick={handle_detect}
          disabled={is_builder}
          aria-label={translate("DCS_GEO_DETECT_BUTTON")}
          title={translate("DCS_GEO_DETECT_BUTTON")}
          className="dcs-geo-detect-button flex items-center justify-center cursor-pointer flex-shrink-0"
          style={{ width: 46, borderRadius: 8, border: "1px solid #056daa", background: "#FFFFFF" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#056daa" strokeWidth="2">
            <path d="M21 12a9 9 0 11-3.5-7.14" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
        </button>
      </div>

      {status && (
        <p className="text-xs mb-2" style={{ color: status.type === "error" ? "#E74C3C" : status.type === "success" ? "#4CAF50" : "#056daa" }}>
          {status.message}
        </p>
      )}
      {status && status.show_guide && (
        <div className="text-xs mb-3 border p-2" style={{ borderColor: "#E74C3C", color: "#842029", backgroundColor: "rgba(231,76,60,0.06)", borderRadius: 8 }}>
          {translate("DCS_GEO_ENABLE_LOCATION_GUIDE")}
        </div>
      )}

      <div className="dcs-geo-coords-row flex gap-2 mb-3">
        <div className="flex-1" style={{ minWidth: 0 }}>
          <label className="cok-auth-label">{translate("DCS_GEO_LATITUDE_LABEL")}</label>
          <input type="number" step="any" className="cok-auth-input w-full py-2" disabled value={details.latitude ?? ""} />
        </div>
        <div className="flex-1" style={{ minWidth: 0 }}>
          <label className="cok-auth-label">{translate("DCS_GEO_LONGITUDE_LABEL")}</label>
          <input type="number" step="any" className="cok-auth-input w-full py-2" disabled value={details.longitude ?? ""} />
        </div>
      </div>

      {is_online ? (
        <>
          {is_builder ? (
            <div className="dcs-geo-map flex items-center justify-center text-xs mb-3" style={{ borderRadius: 10, border: "1px dashed #E0E0E0", color: "#9E9E9E" }}>
              {translate("DCS_GEO_MAP_PREVIEW_PLACEHOLDER")}
            </div>
          ) : (
            <div ref={map_container_ref} className="dcs-geo-map mb-3" style={{ width: "100%", borderRadius: 10, border: "1px solid #E0E0E0", overflow: "hidden" }} />
          )}

          <div className="p-3" style={{ border: "1px solid #E0E0E0", borderRadius: 10 }}>
            <p className="text-xs font-semibold uppercase mb-2" style={{ color: "#9E9E9E", letterSpacing: "0.5px" }}>
              {translate("DCS_GEO_DETAILS_TITLE")}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.75rem" }}>
              {GEO_DETAIL_ROWS.map((row) => {
                const raw_value = row.is_accuracy ? details.accuracy : details[row.key];
                return (
                  <div key={row.key} style={{ gridColumn: row.full_width ? "1 / -1" : undefined, minWidth: 0 }}>
                    <p className="text-xs" style={{ color: "#9E9E9E" }}>
                      {translate(row.labelKey)}
                    </p>
                    <p className="text-sm font-semibold" style={{ color: "#333333", wordBreak: "break-word" }}>
                      {row.is_accuracy
                        ? format_accuracy(details.accuracy)
                        : raw_value == null || raw_value === ""
                          ? translate("DCS_GEO_NOT_AVAILABLE")
                          : raw_value}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <p className="text-xs mb-3 border p-2" style={{ color: "#9E9E9E", borderColor: "#E0E0E0", borderRadius: 8 }}>
          {translate("DCS_GEO_OFFLINE_HIDDEN_NOTICE")}
        </p>
      )}

      {error && (
        <p className="mt-1 text-xs" style={{ color: "#E74C3C", fontFamily: "'Montserrat', sans-serif", whiteSpace: "pre-line" }}>
          {error}
        </p>
      )}
      {!error && has_value && ruleValidMessage && (
        <p className="mt-1 text-xs" style={{ color: "#4CAF50", fontFamily: "'Montserrat', sans-serif", whiteSpace: "pre-line" }}>
          {ruleValidMessage}
        </p>
      )}
    </div>
  );
}
