/**
 * Squarified treemap layout (Bruls, Huizing and van Wijk): every value gets
 * a rectangle whose AREA is its share of the whole, laid out in rows chosen
 * to keep the rectangles as close to square as they can be.
 *
 * This is computed here rather than taken from the charting library
 * because that library rounds every rectangle to whole pixels as it places
 * it - row height, then each width, then the leftover pushed onto the last
 * tile of the row. On a wide card that is invisible; on a small one, with
 * a dozen tiles and counts like 3 and 5, the rounding swallows the
 * difference and the tiles come out the same size while the numbers on
 * them plainly are not. The whole point of a treemap is that a 5 is bigger
 * than a 3, so the arithmetic stays in floating point until the very last
 * step, and the rectangles are exact.
 */

const area_of = (row) => row.reduce((sum, item) => sum + item.area, 0);

/**
 * How square the rectangles of a row would be if it were closed now -
 * the worst (largest) aspect ratio in it. Lower is better, 1 is a square.
 */
function worst(row, side) {
  if (row.length === 0 || side <= 0) return Infinity;
  const total = area_of(row);
  if (total <= 0) return Infinity;
  const widest = row.reduce((best, item) => Math.max(best, item.area), 0);
  const narrowest = row.reduce((best, item) => Math.min(best, item.area), Infinity);
  if (narrowest <= 0) return Infinity;
  const span = side * side;
  return Math.max((span * widest) / (total * total), (total * total) / (span * narrowest));
}

/**
 * Lays one finished row along the shorter side of the space left, and
 * returns what remains for the rows after it.
 */
function place(row, rect, out) {
  const total = area_of(row);
  if (total <= 0) return rect;
  const vertical = rect.width >= rect.height;
  // The strip this row fills: down the left when the space is wide, across
  // the top when it is tall.
  const thickness = vertical ? total / rect.height : total / rect.width;
  let along = vertical ? rect.y : rect.x;
  row.forEach((item) => {
    const length = item.area / thickness;
    out[item.index] = vertical
      ? { x: rect.x, y: along, width: thickness, height: length }
      : { x: along, y: rect.y, width: length, height: thickness };
    along += length;
  });
  return vertical
    ? { x: rect.x + thickness, y: rect.y, width: Math.max(0, rect.width - thickness), height: rect.height }
    : { x: rect.x, y: rect.y + thickness, width: rect.width, height: Math.max(0, rect.height - thickness) };
}

/**
 * The rectangle for each value, in the order the values were given.
 * A value of zero or less has no area and gets no rectangle (null): it is
 * not drawn, because there is nothing of it to draw. Returns [] for an
 * empty box.
 */
export function squarify(values, box) {
  const out = new Array((values || []).length).fill(null);
  const width = Number(box && box.width) || 0;
  const height = Number(box && box.height) || 0;
  if (width <= 0 || height <= 0) return out;
  const items = (values || [])
    .map((value, index) => ({ index, value: Number(value) > 0 ? Number(value) : 0 }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
  if (items.length === 0) return out;
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const scale = (width * height) / total;
  const scaled = items.map((item) => ({ index: item.index, area: item.value * scale }));

  let rect = { x: Number(box.x) || 0, y: Number(box.y) || 0, width, height };
  let row = [];
  scaled.forEach((item) => {
    const side = Math.min(rect.width, rect.height);
    // Keep adding to this row while doing so makes its rectangles squarer.
    if (row.length === 0 || worst(row.concat(item), side) <= worst(row, side)) {
      row.push(item);
      return;
    }
    rect = place(row, rect, out);
    row = [item];
  });
  if (row.length > 0) place(row, rect, out);
  return out;
}
