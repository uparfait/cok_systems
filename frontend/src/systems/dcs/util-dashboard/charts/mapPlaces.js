import { bounds_of, anchor_of } from "./mapGeometry.js";

// Roughly how wide one letter of a place name draws, per pixel of font size.
const LETTER_WIDTH = 0.58;

/**
 * Which places may write their name and plant their markers, and what room
 * each of them needs to do it inside its own boundary. Only the NAME needs
 * its boundary to have room: a marker is planted however small the place
 * is on screen. The room rule itself is applied where the places are
 * drawn (mapOverlay on the engine, MapSvg on the fallback), at every zoom.
 * The same list serves a world map and a heat map, so the names and
 * counts read alike over coloured boundaries and over heat.
 */
export function build_places(shapes, { marks_of, label_text, font }) {
  return (shapes || [])
    .map((shape, index) => {
      const marks = marks_of(shape);
      const label = label_text(shape);
      const box = bounds_of([shape]);
      const point = anchor_of(shape);
      if ((!label && marks.length === 0) || !box || !point) return null;
      const needed = [label ? label.length * font * LETTER_WIDTH + 6 : 0, label ? font * 1.6 : 0];
      return { key: `${shape.name}-${index}`, point, box, needed, label, marks, font };
    })
    .filter(Boolean);
}
