const { location_tree, PROVINCE_TRANSLATIONS } = require("../controllers/locations/get_locations.js");

/**
 * The country's locations by administrative level, for whoever has to
 * OFFER or RECOGNISE a location outside the live form: the import's
 * Excel template lists every name at a field's level, and the import
 * turns what was typed back into the spelling a submission stores.
 *
 * A submission stores the raw name alone (a province as "Umujyi wa
 * Kigali", never its translation), which is what the public cascading
 * field writes; a province is shown through its translations.
 */
const LEVELS = ["provinces", "districts", "sectors", "cells", "villages"];
const CHILD_KEYS = ["districts", "sectors", "cells", "villages"];

const normalize = (value) => String(value === undefined || value === null ? "" : value).trim().toLowerCase();
const item_name = (item) => (typeof item === "string" ? item : item && item.name ? String(item.name) : "");

function item_translations(item) {
  if (!item || typeof item !== "object") return null;
  return item.translations || PROVINCE_TRANSLATIONS[item.name] || null;
}

/** Every item at one level across the whole country, in tree order. */
function items_at_level(level, tree) {
  const root = tree || location_tree;
  const country = root && root.Rwanda;
  const depth = LEVELS.indexOf(level);
  if (!country || depth < 0) return [];
  const found = [];
  const walk = (items, index) => {
    (items || []).forEach((item) => {
      if (index === depth) {
        if (item_name(item)) found.push(item);
        return;
      }
      if (item && typeof item === "object") walk(item[CHILD_KEYS[index]], index + 1);
    });
  };
  walk(country.provinces, 0);
  return found;
}

/** The label a dropdown shows for one item in a language: a province's translation, otherwise its name. */
function item_label(item, language) {
  const translations = item_translations(item);
  return (translations && (translations[language] || translations.en)) || item_name(item);
}

/** Every label at a level, each once, sorted - what the import template's dropdown offers. */
function location_labels_at_level(level, language, tree) {
  const seen = new Set();
  const labels = [];
  items_at_level(level, tree).forEach((item) => {
    const label = item_label(item, language);
    if (!label || seen.has(label)) return;
    seen.add(label);
    labels.push(label);
  });
  return labels.sort((a, b) => a.localeCompare(b));
}

/**
 * The stored spelling of a location typed at a level: matched against the
 * raw name and every translation, case-insensitively; null when the level
 * holds nothing by that name.
 */
function canonical_location_name(level, text, tree) {
  const wanted = normalize(text);
  if (!wanted) return null;
  const match = items_at_level(level, tree).find((item) => {
    if (normalize(item_name(item)) === wanted) return true;
    const translations = item_translations(item);
    return translations ? Object.values(translations).some((entry) => normalize(entry) === wanted) : false;
  });
  return match ? item_name(match) : null;
}

module.exports = { LEVELS, items_at_level, location_labels_at_level, canonical_location_name };
