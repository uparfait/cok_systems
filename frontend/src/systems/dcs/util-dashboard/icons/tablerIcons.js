let icons_promise = null;
let loaded_module = null;

/**
 * The whole Tabler icon set is a heavy module, so it is loaded on demand
 * (the first KPI card carrying an icon, or the first time the picker opens)
 * and then kept for the rest of the session.
 */
export function load_tabler_icons() {
  if (!icons_promise) {
    icons_promise = import("@tabler/icons-react").then((module) => {
      loaded_module = module;
      return module;
    });
  }
  return icons_promise;
}

export function loaded_tabler_icons() {
  return loaded_module;
}

export const ICON_NAME_PATTERN = /^Icon[A-Za-z0-9]+$/;

export function is_icon_name(name) {
  return typeof name === "string" && ICON_NAME_PATTERN.test(name);
}

/** Every icon component name the module exports, alphabetically. */
export function list_icon_names(module) {
  return Object.keys(module)
    .filter((key) => is_icon_name(key) && module[key])
    .sort();
}

/** "IconChartBar" reads as "Chart Bar". */
export function icon_label(name) {
  return String(name || "")
    .replace(/^Icon/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2");
}

/** Case-insensitive match on the name with spaces ignored. */
export function filter_icon_names(names, query) {
  const needle = String(query || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!needle) return names;
  return names.filter((name) => name.toLowerCase().includes(needle));
}
