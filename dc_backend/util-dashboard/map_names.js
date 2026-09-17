/**
 * How a place name written by a person is compared with a place name in the
 * boundary files. The two lists were written by different hands, so a name
 * is reduced to what it really is before anything is compared: no case, no
 * punctuation, no administrative word ("Umujyi wa Kigali" is "City of
 * Kigali"), and l written as r, the two standing for one sound that the
 * lists disagree about ("Ruliba" is "Ruriba").
 *
 * The frontend mirrors this in
 * frontend/src/systems/dcs/util-dashboard/charts/mapGeometry.js (map_key),
 * so a label always finds the boundary it belongs to.
 */

// What people put in front of (or after) a place's real name, in the three
// languages of the system.
const PREFIXES = [/^umujyi wa /, /^intara ya /, /^intara y'/, /^akarere ka /, /^umurenge wa /, /^akagari ka /, /^umudugudu wa /, /^city of /, /^province of /, /^district of /];
const SUFFIXES = [/ city$/, / province$/, / district$/, / sector$/, / cell$/, / village$/, / intara$/, / akarere$/, / umurenge$/, / akagari$/, / umudugudu$/];

function normalize(name) {
  let text = String(name || "").toLowerCase().trim();
  PREFIXES.forEach((pattern) => {
    text = text.replace(pattern, "");
  });
  SUFFIXES.forEach((pattern) => {
    text = text.replace(pattern, "");
  });
  return text.replace(/[^a-z0-9]/g, "").replace(/l/g, "r");
}

/** The same name with its vowels dropped, where spelling variants meet. */
const skeleton = (name) => normalize(name).replace(/[aeiou]/g, "");

module.exports = { normalize, skeleton };
