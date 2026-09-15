import React from "react";

/**
 * Textures that tell a third dimension apart INSIDE a color: dots, diagonal
 * lines, horizontal lines, vertical lines and a cross-hatch, each drawn in
 * translucent white over the segment's own color so the color still reads
 * and never collides with another. Pattern 0 is the plain color.
 */

export const PATTERN_COUNT = 6;
const SERIES_KEY_SEPARATOR = "||";

export const pattern_id = (uid, split_index, pattern_index) => `dcs-pat-${uid}-${split_index}-${pattern_index}`;

function PatternShape({ index, color }) {
  const ink = "rgba(255,255,255,0.85)";
  if (index === 1) return <circle cx={4} cy={4} r={1.6} fill={ink} />;
  if (index === 2) return <path d="M0 8 L8 0" stroke={ink} strokeWidth={1.6} />;
  if (index === 3) return <path d="M0 4 L8 4" stroke={ink} strokeWidth={1.6} />;
  if (index === 4) return <path d="M4 0 L4 8" stroke={ink} strokeWidth={1.6} />;
  if (index === 5) return <path d="M0 4 L8 4 M4 0 L4 8" stroke={ink} strokeWidth={1.2} />;
  return <rect width={8} height={8} fill={color} />;
}

/** The <defs> block holding one pattern per (split color, pattern index) pair. */
export function PatternDefs({ uid, colors, patternCount }) {
  const count = Math.min(PATTERN_COUNT, patternCount || 0);
  if (count <= 1) return null;
  return (
    <defs>
      {colors.map((color, split_index) =>
        Array.from({ length: count }, (_, pattern_index) => pattern_index).map((pattern_index) =>
          pattern_index === 0 ? null : (
            <pattern key={pattern_id(uid, split_index, pattern_index)} id={pattern_id(uid, split_index, pattern_index)} width={8} height={8} patternUnits="userSpaceOnUse">
              <rect width={8} height={8} fill={color} />
              <PatternShape index={pattern_index} color={color} />
            </pattern>
          ),
        ),
      )}
    </defs>
  );
}

/** The fill of one series segment: plain color, or the pattern over it. */
export function pattern_fill(uid, split_index, pattern_index, color) {
  return pattern_index > 0 && pattern_index < PATTERN_COUNT ? `url(#${pattern_id(uid, split_index, pattern_index)})` : color;
}

/**
 * How every series of a split chart is drawn. Without series_meta a
 * series is one split value with its own color; with it, a series is a
 * split (color) / pattern (texture) pair.
 */
export function series_display(series, meta, palette) {
  if (!Array.isArray(meta) || meta.length === 0) {
    return {
      items: (series || []).map((key, index) => ({ key, label: key, color: palette.color_for(key, index), split_index: index, pattern_index: 0 })),
      splits: [],
      patterns: [],
    };
  }
  const splits = [];
  const patterns = [];
  meta.forEach((entry) => {
    if (!splits.includes(entry.split)) splits.push(entry.split);
    if (!patterns.includes(entry.pattern)) patterns.push(entry.pattern);
  });
  const items = meta.map((entry) => {
    const split_index = splits.indexOf(entry.split);
    const pattern_index = Math.min(PATTERN_COUNT - 1, patterns.indexOf(entry.pattern));
    return { key: entry.key, label: `${entry.split} ${SERIES_KEY_SEPARATOR} ${entry.pattern}`, color: palette.color_for(entry.split, split_index), split_index, pattern_index, split: entry.split, pattern: entry.pattern };
  });
  return { items, splits, patterns };
}

/** A small swatch previewing one pattern index on a neutral base. */
export function PatternSwatch({ index, color, size }) {
  const px = size || 14;
  const uid = `swatch-${index}`;
  return (
    <svg width={px} height={px} aria-hidden="true">
      <PatternDefs uid={uid} colors={[color]} patternCount={index + 1} />
      <rect width={px} height={px} fill={pattern_fill(uid, 0, index, color)} />
    </svg>
  );
}
