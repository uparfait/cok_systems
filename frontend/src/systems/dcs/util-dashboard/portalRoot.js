/**
 * Where the board's portalled panels (dropdowns, dialogs, overlays) mount.
 * In browser full screen only the full-screen element and its descendants
 * are painted, so anything portalled onto document.body would vanish the
 * moment the board goes full screen. Mounting into the full-screen element
 * itself, while one is active, keeps every menu and dialog visible there;
 * otherwise the page body is used as before.
 */
export function portal_root() {
  if (typeof document === "undefined") return null;
  return document.fullscreenElement || document.webkitFullscreenElement || document.body;
}
