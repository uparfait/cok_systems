import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Browser-native full screen for the dashboard board plus its chrome: the
 * fit/scroll viewing mode, the self-correcting fit zoom, and the auto-hiding
 * fixed header. enter() requests real fullscreen on the container; on
 * browsers without the API (iOS Safari) it falls back to a fixed
 * full-viewport overlay. Exiting through the button, the Escape key or the
 * browser's own UI all land back in the normal layout.
 */
export function useBoardFullscreen() {
  const container_ref = useRef(null);
  const grid_ref = useRef(null);
  const hide_timer_ref = useRef(null);
  const [is_fullscreen, setIsFullscreen] = useState(false);
  const [is_fallback, setIsFallback] = useState(false);
  // Full screen opens in scroll mode: natural size, nothing shrunk away.
  const [fs_mode, setFsMode] = useState("scroll");
  const [fit_scale, setFitScale] = useState(1);
  const [header_visible, setHeaderVisible] = useState(true);

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

  // The fixed header lives on hover in full screen: it slides away 100ms
  // after the pointer leaves it, and comes back the moment the pointer
  // returns to the top edge.
  const cancel_header_hide = () => {
    if (hide_timer_ref.current) window.clearTimeout(hide_timer_ref.current);
  };
  const show_header = () => {
    cancel_header_hide();
    setHeaderVisible(true);
  };
  const schedule_header_hide = (delay_ms) => {
    cancel_header_hide();
    hide_timer_ref.current = window.setTimeout(() => setHeaderVisible(false), delay_ms);
  };

  useEffect(() => {
    if (!is_fullscreen) {
      cancel_header_hide();
      setHeaderVisible(true);
      return undefined;
    }
    setHeaderVisible(true);
    schedule_header_hide(100);
    return cancel_header_hide;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is_fullscreen]);

  // Fit mode keeps EVERYTHING on one screen at the LARGEST zoom possible: a
  // small board zooms in to fill the viewport, a huge one zooms out just
  // enough that nothing hides behind a scrollbar. A ResizeObserver keeps
  // re-measuring as data streams in and the grid reflows; the bounding rect
  // is the VISUAL size, so the next factor is the current one corrected by
  // how far off the visual height is. The tolerance stops ping-pong.
  useLayoutEffect(() => {
    if (!is_fullscreen || fs_mode !== "fit") {
      setFitScale(1);
      return undefined;
    }
    const grid = grid_ref.current;
    const container = container_ref.current;
    if (!grid || !container) return undefined;

    let frame = null;
    const compute = () => {
      const available = container.clientHeight - 40;
      const visual = grid.getBoundingClientRect().height;
      if (visual <= 0 || available <= 0) return;
      setFitScale((current) => {
        const desired = Math.min(3, Math.max(0.2, Math.floor((available / visual) * current * 100) / 100));
        return Math.abs(desired - current) > 0.03 ? desired : current;
      });
    };
    const schedule = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(compute);
    };

    compute();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    if (observer) observer.observe(grid);
    window.addEventListener("resize", schedule);
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is_fullscreen, fs_mode]);

  return {
    container_ref,
    grid_ref,
    is_fullscreen,
    is_fallback,
    enter,
    exit,
    fs_mode,
    setFsMode,
    fit_scale,
    header_visible,
    show_header,
    schedule_header_hide,
  };
}
