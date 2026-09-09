import { useEffect, useRef, useState } from "react";

/**
 * Browser-native full screen for the dashboard board. enter() requests real
 * fullscreen on the container; on browsers without the API (iOS Safari) it
 * falls back to a fixed full-viewport overlay so the experience stays the
 * same. Exiting through the button, the Escape key or the browser's own UI
 * all land back in the normal layout.
 */
export function useBoardFullscreen() {
  const container_ref = useRef(null);
  const [is_fullscreen, setIsFullscreen] = useState(false);
  const [is_fallback, setIsFallback] = useState(false);

  useEffect(() => {
    const handle_change = () => {
      const active_element = document.fullscreenElement || document.webkitFullscreenElement || null;
      setIsFullscreen((current) => {
        const native_active = active_element === container_ref.current && active_element !== null;
        // A fallback overlay is not tracked by the fullscreen API - keep it.
        return native_active || (current && is_fallback);
      });
    };
    document.addEventListener("fullscreenchange", handle_change);
    document.addEventListener("webkitfullscreenchange", handle_change);
    return () => {
      document.removeEventListener("fullscreenchange", handle_change);
      document.removeEventListener("webkitfullscreenchange", handle_change);
    };
  }, [is_fallback]);

  // The fallback overlay closes on Escape, matching native fullscreen.
  useEffect(() => {
    if (!is_fallback || !is_fullscreen) return undefined;
    const handle_key = (event) => {
      if (event.key === "Escape") {
        setIsFullscreen(false);
        setIsFallback(false);
      }
    };
    document.addEventListener("keydown", handle_key);
    return () => document.removeEventListener("keydown", handle_key);
  }, [is_fallback, is_fullscreen]);

  const open_fallback = () => {
    setIsFallback(true);
    setIsFullscreen(true);
  };

  const enter = () => {
    const node = container_ref.current;
    if (!node) return;
    const request = node.requestFullscreen || node.webkitRequestFullscreen;
    if (!request) {
      open_fallback();
      return;
    }
    try {
      const result = request.call(node);
      if (result && typeof result.then === "function") {
        result.then(() => setIsFullscreen(true)).catch(open_fallback);
      } else {
        setIsFullscreen(true);
      }
    } catch (error) {
      open_fallback();
    }
  };

  const exit = () => {
    if (is_fallback) {
      setIsFallback(false);
      setIsFullscreen(false);
      return;
    }
    const leave = document.exitFullscreen || document.webkitExitFullscreen;
    if (leave && (document.fullscreenElement || document.webkitFullscreenElement)) {
      try {
        leave.call(document);
      } catch (error) {
        setIsFullscreen(false);
      }
    } else {
      setIsFullscreen(false);
    }
  };

  return { container_ref, is_fullscreen, is_fallback, enter, exit };
}
