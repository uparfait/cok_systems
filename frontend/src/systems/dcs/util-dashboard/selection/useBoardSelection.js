import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The dashboard's selection mode: toggled with Ctrl+Alt+S (Cmd+Option+S
 * on a Mac) and left with Esc. While it is on, clicking a widget selects
 * it, dragging one onto another moves it there, and the selected widgets
 * can be edited together or deleted. Everything happens on a WORKING COPY
 * of the widget list; nothing reaches the server until save() is called.
 */

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");

export const SHORTCUT_LABEL = IS_MAC ? "Cmd+Option+S" : "Ctrl+Alt+S";

function is_toggle_shortcut(event) {
  if (!event.altKey || String(event.key).toLowerCase() !== "s") return false;
  return IS_MAC ? event.metaKey : event.ctrlKey;
}

export function useBoardSelection(widgets, options) {
  const { enabled, onRequestExit } = options || {};
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [working, setWorking] = useState([]);
  const [dirty, setDirty] = useState(false);
  const active_ref = useRef(false);
  active_ref.current = active;

  const enter = useCallback(() => {
    setWorking(widgets.map((widget) => ({ ...widget })));
    setSelected(new Set());
    setDirty(false);
    setActive(true);
  }, [widgets]);

  const exit = useCallback(() => {
    setActive(false);
    setSelected(new Set());
    setWorking([]);
    setDirty(false);
  }, []);

  // Leaving with unsaved changes asks first (the page owns the dialog).
  const request_exit = useCallback(() => {
    if (!active_ref.current) return;
    if (dirty && onRequestExit) onRequestExit();
    else exit();
  }, [dirty, exit, onRequestExit]);

  useEffect(() => {
    if (!enabled) return undefined;
    const on_key = (event) => {
      const target = event.target;
      const typing = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (is_toggle_shortcut(event)) {
        event.preventDefault();
        if (active_ref.current) request_exit();
        else enter();
        return;
      }
      if (event.key === "Escape" && active_ref.current && !typing) {
        event.preventDefault();
        request_exit();
      }
    };
    window.addEventListener("keydown", on_key);
    return () => window.removeEventListener("keydown", on_key);
  }, [enabled, enter, request_exit]);

  const toggle = useCallback((id) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const select_all = useCallback(() => setSelected(new Set(working.map((widget) => widget.id))), [working]);
  const clear = useCallback(() => setSelected(new Set()), []);

  /** Moves the dragged widget to the position of the one it was dropped on. */
  const move = useCallback((from_id, to_id) => {
    if (!from_id || !to_id || from_id === to_id) return;
    setWorking((current) => {
      const from = current.findIndex((widget) => widget.id === from_id);
      const to = current.findIndex((widget) => widget.id === to_id);
      if (from === -1 || to === -1) return current;
      const next = current.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next.map((widget, index) => ({ ...widget, position: index }));
    });
    setDirty(true);
  }, []);

  const remove_selected = useCallback(() => {
    setWorking((current) => current.filter((widget) => !selected.has(widget.id)).map((widget, index) => ({ ...widget, position: index })));
    setSelected(new Set());
    setDirty(true);
  }, [selected]);

  /** patches: { [widget id]: partial widget } */
  const apply_patches = useCallback((patches) => {
    setWorking((current) => current.map((widget) => (patches[widget.id] ? { ...widget, ...patches[widget.id] } : widget)));
    setDirty(true);
  }, []);

  const selected_widgets = working.filter((widget) => selected.has(widget.id));

  return { active, selected, selected_widgets, working, dirty, enter, exit, request_exit, toggle, select_all, clear, move, remove_selected, apply_patches };
}
