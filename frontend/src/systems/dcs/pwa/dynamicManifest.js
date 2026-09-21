const DEFAULT_MANIFEST_HREF = "/manifest.json";
const DEFAULT_APP_TITLE = "IKAZE";
const ICON_PATH = "/LOGO_COK.png";
const THEME_COLOR = "#056daa";

/**
 * The public form lives at /dcs-form/<id>; an installed copy must open
 * that very page, not the portal root, so the manifest is generated per
 * form with the current URL as start_url and id.
 */
export function is_public_form_path(pathname) {
  return typeof pathname === "string" && pathname.indexOf("/dcs-form/") === 0;
}

function manifest_link() {
  let link = document.querySelector('link[rel="manifest"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "manifest");
    document.head.appendChild(link);
  }
  return link;
}

function set_apple_title(title) {
  let meta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "apple-mobile-web-app-title");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", title);
}

/**
 * Points the page's manifest at a generated one whose start_url, id and
 * name belong to this form. Absolute URLs throughout: a data: manifest has
 * no base to resolve relative paths against.
 */
export function apply_form_manifest(options) {
  const { name, short_name, start_url, language } = options || {};
  const origin = window.location.origin;
  const absolute_start = new URL(start_url || window.location.pathname + window.location.search, origin).href;
  const title = name || "Data collection form";
  const manifest = {
    id: absolute_start,
    name: title,
    short_name: (short_name || title).slice(0, 30),
    description: title,
    start_url: absolute_start,
    scope: origin + "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: THEME_COLOR,
    orientation: "portrait-primary",
    lang: language || "en",
    icons: [
      { src: origin + ICON_PATH, sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: origin + ICON_PATH, sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  };
  const href = "data:application/manifest+json;charset=utf-8," + encodeURIComponent(JSON.stringify(manifest));
  const link = manifest_link();
  if (link.getAttribute("href") !== href) link.setAttribute("href", href);
  set_apple_title(manifest.short_name);
  return manifest;
}

export function restore_default_manifest() {
  manifest_link().setAttribute("href", DEFAULT_MANIFEST_HREF);
  set_apple_title(DEFAULT_APP_TITLE);
}

export function is_standalone_display() {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  } catch (media_error) {
    return false;
  }
}

export function detect_platform() {
  const agent = window.navigator.userAgent || "";
  const is_ios = /iPad|iPhone|iPod/.test(agent) || (agent.indexOf("Macintosh") >= 0 && "ontouchend" in document);
  if (is_ios) return "ios";
  if (/Android/.test(agent)) return "android";
  return "desktop";
}

/** The deferred beforeinstallprompt event main.tsx parked for us, if any. */
export function pending_install_prompt() {
  return window.__dcs_install_prompt || null;
}
