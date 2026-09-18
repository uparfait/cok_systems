import React, { useEffect, useRef, useState } from "react";
import { build_palette } from "../appearance.js";
import { chart_density } from "./density.js";
import { fit_text } from "./chartLabels.jsx";
import { squarify } from "./treemapLayout.js";
import { LegendRow, LegendFrame } from "./SeriesLegend.jsx";

/**
 * A treemap: one rectangle per value, its AREA its share of the total, so
 * a 5 is visibly bigger than a 3. The rectangles are placed by our own
 * squarify (see treemapLayout) and drawn as plain SVG - the charting
 * library rounded every rectangle to whole pixels as it placed them, which
 * on a small card flattened small differences until unequal numbers came
 * out as equal tiles, and it also hid every label for the length of the
 * grow-in animation.
 *
 * Colors: each tile takes the color set for its own value when there is
 * one, and otherwise its own place in the palette - so a treemap is a
 * spread of colors by default and every one of them can be changed. The
 * writing on a tile is read against THAT TILE, so it turns dark or light
 * to suit whatever color the tile was given.
 *
 * Text: a name is written only where its rectangle can hold it, measured,
 * never spilling over a neighbour. Past a crowd of values (CROWD_FROM) the
 * tiles carry no text at all - forty names in forty slivers is a grey blur
 * - and the names move to a legend beside or under the chart, where they
 * read as a list. The tile under the pointer always names itself, whatever
 * the crowd, so nothing is ever more than a hover away.
 */

// Past this many values, names live in the legend instead of on the tiles.
const CROWD_FROM = 12;
// A tile smaller than this in either direction cannot hold readable text.
const MIN_TEXT_PX = 14;

/** The live size of the box the tiles are laid out in. */
function useBoxSize(element_ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = element_ref.current;
    if (!element) return undefined;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    if (typeof window.ResizeObserver !== "function") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new window.ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element_ref]);
  return size;
}

function Tile({ node, rect, color, label, font, ink, format, crowded, hovered, onHover, onPick }) {
  const is_hovered = hovered === node.name;
  const quiet = crowded && !is_hovered;
  // Room for the name on its own line, and for the number under it.
  const text = quiet || rect.width < MIN_TEXT_PX * 2 ? "" : fit_text(label, rect.width - 10, font);
  const show_name = text !== "" && rect.height > font * 2.2;
  const show_value = !show_name && !quiet && rect.height > MIN_TEXT_PX && rect.width > MIN_TEXT_PX * 1.6;
  const number = format(node.value);
  return (
    <g
      onClick={onPick ? () => onPick(node) : undefined}
      onMouseEnter={() => onHover(node.name)}
      onMouseLeave={() => onHover(null)}
      style={onPick ? { cursor: "pointer" } : undefined}
    >
      <title>{`${label}: ${number}`}</title>
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        style={{
          fill: color,
          stroke: "rgba(255,255,255,0.9)",
          strokeWidth: 1.5,
          // In a crowd the hovered tile is the one being read; the rest
          // steps back so it stands out of the mosaic.
          opacity: hovered && !is_hovered ? 0.5 : 1,
          transition: "opacity 160ms ease",
        }}
      />
      {show_name && (
        <text x={rect.x + 5} y={rect.y + font + 3} fill={ink} fontSize={font} fontWeight={600} pointerEvents="none">
          {text}
        </text>
      )}
      {show_name && rect.height > font * 3.2 && (
        <text x={rect.x + 5} y={rect.y + font * 2.4 + 3} fill={ink} opacity={0.85} fontSize={font} pointerEvents="none">
          {number}
        </text>
      )}
      {show_value && (
        <text x={rect.x + rect.width / 2} y={rect.y + rect.height / 2} fill={ink} fontSize={font} fontWeight={600} textAnchor="middle" dominantBaseline="central" pointerEvents="none">
          {number}
        </text>
      )}
    </g>
  );
}

export default function TreemapChart({ nodes, palette, density, onItemClick }) {
  const colors = palette || build_palette(null);
  const size = density || chart_density();
  const list = nodes || [];
  const crowded = list.length > CROWD_FROM;
  const font = Math.max(9, size.font);
  const box_ref = useRef(null);
  const box = useBoxSize(box_ref);
  const [hovered, setHovered] = useState(null);

  const color_of = (node, index) => colors.color_override(node.name) || colors.color_for(node.name, index);
  const name_of = (node) => (colors.name_for ? colors.name_for(node.name) : node.name);
  const rects = squarify(list.map((node) => node.value), { x: 0, y: 0, width: box.width, height: size.height });

  const chart = (
    <div ref={box_ref} style={{ width: "100%", height: size.height, maxWidth: "100%" }}>
      {box.width > 0 && (
        <svg width={box.width} height={size.height} role="img">
          {list.map((node, index) =>
            rects[index] ? (
              <Tile
                key={`${node.name}-${index}`}
                node={node}
                rect={rects[index]}
                color={color_of(node, index)}
                label={String(name_of(node))}
                ink={colors.on_mark(color_of(node, index))}
                format={colors.number_text}
                font={font}
                crowded={crowded}
                hovered={hovered}
                onHover={setHovered}
                onPick={onItemClick}
              />
            ) : null,
          )}
        </svg>
      )}
    </div>
  );

  if (!crowded) return chart;
  // Every tile in the legend, in its own color, so a mosaic of unlabelled
  // rectangles can still be read.
  const legend = (
    <LegendRow
      items={list.map((node, index) => ({ label: node.name, color: color_of(node, index), value: node.value }))}
      palette={colors}
      square
      onItemClick={onItemClick ? (label) => onItemClick({ name: label }) : undefined}
    />
  );
  return (
    <LegendFrame position={colors.legend_position} density={size} legend={legend}>
      {chart}
    </LegendFrame>
  );
}
