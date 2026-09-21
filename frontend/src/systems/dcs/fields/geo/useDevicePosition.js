import { useCallback, useEffect, useRef, useState } from "react";
import { GEOLOCATION_OPTIONS } from "./geoHelpers.js";

// A watch keeps improving the fix for this long, then stops on its own to
// spare the battery; the Allow / Detect button starts it again.
const WATCH_MAX_MS = 120000;

/**
 * The device's own position, as a continuous watch (each reading is handed
 * to onReading, better fixes arrive over time on phones) with the browser
 * permission state alongside so the field can tell the respondent exactly
 * what is blocking a fix: "prompt" (the native popup will show on start),
 * "denied" (blocked in the browser - only settings can undo that) or
 * "granted". Insecure (http) pages get no location at all in browsers.
 */
export function useDevicePosition({ onReading, onFailure }) {
  const is_supported = typeof window !== "undefined" && !!window.navigator.geolocation;
  const is_secure = typeof window === "undefined" || window.isSecureContext !== false;
  const [permission_state, setPermissionState] = useState("unknown");
  const [watching, setWatching] = useState(false);
  const watch_id_ref = useRef(null);
  const stop_timer_ref = useRef(null);
  const on_reading_ref = useRef(onReading);
  const on_failure_ref = useRef(onFailure);
  on_reading_ref.current = onReading;
  on_failure_ref.current = onFailure;

  useEffect(() => {
    let status = null;
    let cancelled = false;
    const update = () => {
      if (!cancelled && status) setPermissionState(status.state || "unknown");
    };
    if (window.navigator.permissions && window.navigator.permissions.query) {
      window.navigator.permissions
        .query({ name: "geolocation" })
        .then((result) => {
          status = result;
          update();
          result.onchange = update;
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
  }, []);

  const stop = useCallback(() => {
    if (watch_id_ref.current !== null && is_supported) {
      window.navigator.geolocation.clearWatch(watch_id_ref.current);
    }
    watch_id_ref.current = null;
    window.clearTimeout(stop_timer_ref.current);
    setWatching(false);
  }, [is_supported]);

  const start = useCallback(() => {
    if (!is_supported) {
      if (on_failure_ref.current) on_failure_ref.current({ code: "unsupported" });
      return;
    }
    if (!is_secure) {
      if (on_failure_ref.current) on_failure_ref.current({ code: "insecure" });
      return;
    }
    stop();
    const on_success = (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      setPermissionState("granted");
      if (on_reading_ref.current) on_reading_ref.current({ latitude, longitude, accuracy: accuracy == null ? null : accuracy });
    };
    const on_error = (geo_error) => {
      stop();
      if (geo_error && geo_error.code === 1) setPermissionState("denied");
      if (on_failure_ref.current) on_failure_ref.current(geo_error || { code: "unknown" });
    };
    const geolocation = window.navigator.geolocation;
    if (typeof geolocation.watchPosition === "function") {
      watch_id_ref.current = geolocation.watchPosition(on_success, on_error, GEOLOCATION_OPTIONS);
      setWatching(true);
      stop_timer_ref.current = window.setTimeout(stop, WATCH_MAX_MS);
    } else {
      geolocation.getCurrentPosition(on_success, on_error, GEOLOCATION_OPTIONS);
    }
  }, [is_supported, is_secure, stop]);

  useEffect(() => stop, [stop]);

  return { start, stop, permission_state, is_supported, is_secure, watching };
}
