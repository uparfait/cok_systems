import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { get_field_text } from "./fieldText.js";
import GeoDetailsPanel from "./geo/GeoDetailsPanel.jsx";
import { useDevicePosition } from "./geo/useDevicePosition.js";
import {
  RWANDA_CENTER,
  DEFAULT_ZOOM,
  FOUND_ZOOM,
  REGEOCODE_DISTANCE_M,
  MIN_GEOCODE_GAP_MS,
  build_geo_value,
  has_real_coordinates,
  distance_meters,
  is_better_reading,
  reverse_geocode,
  forward_geocode,
} from "./geo/geoHelpers.js";

// Leaflet's default marker image URLs assume a plain <script> tag setup and
// resolve to nothing under a bundler - pointing them at the actual bundled
// asset URLs is required or every marker renders as a broken image icon.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

const ONLINE_POLL_MS = 10000;
const FAILURE_MESSAGE_KEYS = {
  unsupported: "DCS_GEO_STATUS_NOT_SUPPORTED",
  insecure: "DCS_GEO_STATUS_INSECURE",
  denied: "DCS_GEO_STATUS_PERMISSION_DENIED",
  unavailable: "DCS_GEO_STATUS_UNAVAILABLE",
  timeout: "DCS_GEO_STATUS_TIMEOUT",
  unknown: "DCS_GEO_STATUS_UNKNOWN_ERROR",
};

function failure_kind(geo_error) {
  const code = geo_error && geo_error.code;
  if (code === "unsupported" || code === "insecure") return code;
  if (code === 1) return "denied";
  if (code === 2) return "unavailable";
  if (code === 3) return "timeout";
  return "unknown";
}

/**
 * GeoLocation field: the device's own position, watched continuously so a
 * more precise fix replaces a rougher one (never the other way round), or
 * a place searched by name; a pin on a map and the Rwandan administrative
 * breakdown looked up for it. When the browser refuses (permission, GPS
 * off, insecure page) the respondent is told what to do and given a
 * button that re-opens the browser's own permission popup.
 */
export default function GeolocationField({ field, language, mode, value, onChange, error, ruleValidMessage }) {
  const { translate } = useDcsLanguage();
  const is_builder = mode === "builder";
  const help_text = get_field_text(field.help_text, language);
  const details = value || build_geo_value();
  const has_value = details.latitude != null && details.longitude != null;
  const has_real = has_real_coordinates(details);

  const [status, setStatus] = useState(null);
  const [failure, setFailure] = useState(null);
  const [search_text, setSearchText] = useState("");
  const [is_online, setIsOnline] = useState(window.navigator.onLine);

  const map_container_ref = useRef(null);
  const map_ref = useRef(null);
  const marker_ref = useRef(null);
  const starting_ref = useRef(false);
  const details_ref = useRef(details);
  details_ref.current = details;
  const on_change_ref = useRef(onChange);
  on_change_ref.current = onChange;
  const last_geocoded_ref = useRef(null);
  const geocode_timer_ref = useRef(null);
  const announced_ref = useRef(false);
  const override_manual_ref = useRef(false);

  useEffect(() => {
    const sync_online_state = () => setIsOnline(window.navigator.onLine);
    window.addEventListener("online", sync_online_state);
    window.addEventListener("offline", sync_online_state);
    const poll_interval_id = window.setInterval(sync_online_state, ONLINE_POLL_MS);
    return () => {
      window.removeEventListener("online", sync_online_state);
      window.removeEventListener("offline", sync_online_state);
      window.clearInterval(poll_interval_id);
      window.clearTimeout(geocode_timer_ref.current);
    };
  }, []);

  // The map only exists while online and shown; offline unmounts it and a
  // fresh instance is built once the connection is back.
  useEffect(() => {
    if (is_builder || !is_online || !map_container_ref.current || map_ref.current) return;
    const map = L.map(map_container_ref.current).setView(RWANDA_CENTER, DEFAULT_ZOOM);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
    map_ref.current = map;
    return () => {
      map.remove();
      map_ref.current = null;
      marker_ref.current = null;
    };
  }, [is_builder, is_online]);

  useEffect(() => {
    const map = map_ref.current;
    if (!map || !has_real) return;
    if (marker_ref.current) map.removeLayer(marker_ref.current);
    map.setView([details.latitude, details.longitude], FOUND_ZOOM);
    marker_ref.current = L.marker([details.latitude, details.longitude]).addTo(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is_online, has_real, details.latitude, details.longitude]);

  /**
   * Looks the address up for whatever coordinates are current, debounced so
   * a burst of improving fixes costs one request, and only applied when the
   * coordinates have not moved on in the meantime.
   */
  const schedule_geocode = (announce) => {
    window.clearTimeout(geocode_timer_ref.current);
    geocode_timer_ref.current = window.setTimeout(async () => {
      const current = details_ref.current;
      if (!has_real_coordinates(current) || !window.navigator.onLine) return;
      const { latitude, longitude } = current;
      const last = last_geocoded_ref.current;
      if (last && Date.now() - last.at < MIN_GEOCODE_GAP_MS) return schedule_geocode(announce);
      if (announce) setStatus({ type: "loading", message: translate("DCS_GEO_STATUS_LOOKING_UP_ADDRESS") });
      try {
        const address = await reverse_geocode(latitude, longitude);
        last_geocoded_ref.current = { latitude, longitude, at: Date.now() };
        const latest = details_ref.current;
        if (latest.latitude !== latitude || latest.longitude !== longitude) return;
        const next = build_geo_value(Object.assign({}, latest, address));
        details_ref.current = next;
        on_change_ref.current(next);
        if (announce) setStatus({ type: "success", message: translate("DCS_GEO_STATUS_FOUND") });
      } catch (reverse_error) {
        last_geocoded_ref.current = { latitude, longitude, at: Date.now() };
        if (announce) setStatus({ type: "error", message: translate("DCS_GEO_STATUS_ADDRESS_FAILED") });
      }
    }, 1200);
  };

  /**
   * A device reading: kept only when it is at least as good as what is
   * stored (see is_better_reading); the address is kept when the point has
   * barely moved, refreshed otherwise. The first accepted fix is announced,
   * the refinements after it arrive silently.
   */
  const apply_device_reading = ({ latitude, longitude, accuracy }) => {
    const current = details_ref.current;
    starting_ref.current = false;
    if (!override_manual_ref.current && !is_better_reading(current, accuracy)) return;
    override_manual_ref.current = false;
    setFailure(null);
    const last = last_geocoded_ref.current;
    const moved = last ? distance_meters(last.latitude, last.longitude, latitude, longitude) : Infinity;
    const keep_address = moved < REGEOCODE_DISTANCE_M && !!current.full_address;
    const next = build_geo_value(Object.assign({}, keep_address ? current : {}, { latitude, longitude, accuracy, is_manual: false }));
    details_ref.current = next;
    on_change_ref.current(next);
    const announce = !announced_ref.current;
    announced_ref.current = true;
    if (keep_address) {
      if (announce) setStatus({ type: "success", message: translate("DCS_GEO_STATUS_FOUND") });
      return;
    }
    if (!window.navigator.onLine) {
      if (announce) setStatus({ type: "success", message: translate("DCS_GEO_STATUS_OFFLINE_SAVED") });
      return;
    }
    schedule_geocode(announce);
  };

  // Coordinates only ever come from the device or a search - a failed
  // detection still needs a stored value, so (0, 0) is that sentinel. It
  // never overwrites a real reading.
  const apply_failed_detection = () => {
    if (has_real_coordinates(details_ref.current)) return;
    const next = build_geo_value({ latitude: 0, longitude: 0 });
    details_ref.current = next;
    on_change_ref.current(next);
  };

  const handle_failure = (geo_error) => {
    starting_ref.current = false;
    const kind = failure_kind(geo_error);
    setFailure(kind);
    setStatus({ type: "error", message: translate(FAILURE_MESSAGE_KEYS[kind]) });
    apply_failed_detection();
  };

  const position = useDevicePosition({ onReading: apply_device_reading, onFailure: handle_failure });

  const handle_detect = () => {
    setFailure(null);
    announced_ref.current = false;
    override_manual_ref.current = true;
    setStatus({ type: "loading", message: translate("DCS_GEO_STATUS_DETECTING") });
    position.start();
  };

  // No real position and no watch running (first load, a resumed draft
  // whose coordinates were dropped, a watch that ended empty): detect
  // without waiting for a tap. A failure waits for the guide's button.
  useEffect(() => {
    if (is_builder || has_real || failure || position.watching || starting_ref.current) return;
    starting_ref.current = true;
    handle_detect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is_builder, has_real, failure, position.watching]);

  // Permission granted from the browser's own settings while the guide was
  // showing: start again without asking for another tap.
  useEffect(() => {
    if (!is_builder && failure === "denied" && position.permission_state === "granted") handle_detect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position.permission_state]);

  // Back online with coordinates but no address yet: look it up now.
  useEffect(() => {
    if (!is_builder && is_online && has_real && !details.full_address) schedule_geocode(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is_online]);

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
      position.stop();
      setFailure(null);
      const next = build_geo_value({ latitude: found.latitude, longitude: found.longitude, accuracy: null, is_manual: true });
      details_ref.current = next;
      on_change_ref.current(next);
      last_geocoded_ref.current = null;
      schedule_geocode(true);
    } catch (search_error) {
      setStatus({ type: "error", message: translate("DCS_GEO_STATUS_SEARCH_FAILED") });
    }
  };

  const guide_key = () => {
    if (failure === "denied") return position.permission_state === "denied" ? "DCS_GEO_GUIDE_BLOCKED" : "DCS_GEO_GUIDE_PROMPT";
    if (failure === "unavailable") return "DCS_GEO_GUIDE_DEVICE_OFF";
    if (failure === "timeout") return "DCS_GEO_GUIDE_TIMEOUT";
    if (failure === "insecure") return "DCS_GEO_GUIDE_INSECURE";
    return null;
  };
  const guide = guide_key();

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
      {guide && !is_builder && (
        <div className="text-xs mb-3 border p-3 flex items-center gap-3" style={{ borderColor: "#E74C3C", color: "#842029", backgroundColor: "rgba(231,76,60,0.06)", borderRadius: 8 }}>
          <span style={{ whiteSpace: "pre-line", flex: 1, minWidth: 0 }}>{translate(guide)}</span>
          {failure !== "insecure" && (
            <button
              type="button"
              onClick={handle_detect}
              title={translate("DCS_GEO_ALLOW_BUTTON")}
              aria-label={translate("DCS_GEO_ALLOW_BUTTON")}
              className="cursor-pointer flex items-center justify-center flex-shrink-0"
              style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid #056daa", background: "#FFFFFF" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#056daa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                <circle cx="12" cy="12" r="8" />
              </svg>
            </button>
          )}
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
          <GeoDetailsPanel details={details} />
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
