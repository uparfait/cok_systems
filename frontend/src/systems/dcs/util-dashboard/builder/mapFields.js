/**
 * Which fields of a form name a place on the map. The address fields the
 * system ships are cascading selects bound to the locations API, and each
 * says which level it asks for ("districts", "cells"...). A form that does
 * not use them can still be mapped: a choice field plainly named after a
 * level (District / Akarere, Cell / Akagari...) counts too.
 *
 * A map may only be added once the form asks for a district or something
 * below it - a map of provinces alone would be one shape.
 */

export const MAP_LEVELS = ["province", "district", "sector", "cell", "village"];

const LEVEL_OF_SOURCE = { provinces: "province", districts: "district", sectors: "sector", cells: "cell", villages: "village" };

// What people call each level, in the three languages of the system.
const LEVEL_WORDS = {
  province: ["province", "intara"],
  district: ["district", "akarere", "karere"],
  sector: ["sector", "secteur", "umurenge", "murenge"],
  cell: ["cell", "cellule", "akagari", "kagari"],
  village: ["village", "umudugudu", "mudugudu"],
};

const CHOICE_TYPES = ["single_select", "cascading_select", "select_group"];

const words_of = (label) =>
  String(label || "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);

function level_of(field) {
  const source = field && field.raw && field.raw.data_source;
  if (source && LEVEL_OF_SOURCE[source.level]) return LEVEL_OF_SOURCE[source.level];
  if (!field || !CHOICE_TYPES.includes(field.type)) return null;
  const words = words_of(field.label);
  const match = MAP_LEVELS.find((level) => LEVEL_WORDS[level].some((word) => words.includes(word)));
  return match || null;
}

/** [{ level, id, label }] - one entry per field that names places, in map order. */
export function location_fields(fields) {
  const out = [];
  (fields || []).forEach((field) => {
    const level = level_of(field);
    if (level) out.push({ level, id: field.id, label: field.label });
  });
  return out.sort((a, b) => MAP_LEVELS.indexOf(a.level) - MAP_LEVELS.indexOf(b.level));
}

/** The levels this form can actually draw, with the fields that name them. */
export function map_levels_of(fields) {
  const found = location_fields(fields);
  return MAP_LEVELS.filter((level) => found.some((entry) => entry.level === level)).map((level) => ({
    level,
    fields: found.filter((entry) => entry.level === level),
  }));
}

/** A map is worth offering once the form asks for a district or lower. */
export function map_available(fields) {
  return map_levels_of(fields).some((entry) => entry.level !== "province");
}
