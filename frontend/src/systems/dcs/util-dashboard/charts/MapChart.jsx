import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { useMapScope } from "../mapScope.jsx";
import { build_palette, spread_color, with_alpha } from "../appearance.js";
import { chart_density } from "./density.js";
import LibraryIcon from "../icons/LibraryIcon.jsx";
import SpiralLoader from "../../../event-managment/components/SpiralLoader.jsx";
import { bounds_of, make_projection, anchor_of, shape_width, shape_height, map_key } from "./mapGeometry.js";
import MapLegend from "./MapLegend.jsx";
import { MARKER_SET } from "./mapMarkers.js";

const MIN_ZOOM = 1;
const MAX_ZOOM = 14;
// Roughly how wide one letter of a place name draws, per pixel of font size.
const LETTER_WIDTH = 0.58;

/**
 * The City of Kigali, drawn from its own administrative boundaries and
 * zoomed to it: one filled shape per place the widget has data for, each
 * in a color of its own so neighbours are always told apart, with every
 * parent above them outlined behind. A place nobody answered is left pale.
 *
 * A map split by a field (status, gender) plants ONE MARKER PER VALUE on
 * every place: the same icon each time, in the value's own color and
 * carrying that value's own number, which is what the legend names - so
 * the split is read off the map instead of hiding inside one total.
 *
 * The outlines are not part of the widget's data - they are asked for by
 * name (only the places actually answered), with a retry when that fails.
 * The server finds them by walking down the administrative tree, so a name
 * that belongs to several places (a dozen villages are called Kabeza) comes
 * back once per real place, each carrying the chain above it, which is what
 * the tooltip shows to tell them apart.
 * The map pans by dragging (never past its own edge) and zooms on its
 * centre from the wheel or its buttons. Names and markers are plain HTML
 * above the drawing, at a fixed size whatever the zoom, and NEITHER is
 * drawn unless it fits inside its own boundary - so nothing ever lands on
 * the neighbouring place or on its text. A name is written small with no
 * box; a marker is the widget's chosen icon with its number beside it.
 *
 * Every color it paints with comes from the widget's own appearance (text,
 * numbers, background, one color per value), so the map follows the theme
 * and anything set for this widget.
 *
 * A click inside the map opens the records of the place it landed on (a
 * drag never counts as one); the whole widget's records stay behind a
 * double click OUTSIDE the map area, so panning and zooming can never pull
 * the table open.
 */
export default function MapChart({ rows, series, level, marker, showMarkers, showLabels, palette, density, animate, onItemClick, onLegendClick }) {
  const { translate } = useDcsLanguage();
  const { fetch_shapes } = useMapScope();
  const colors = palette || build_palette(null);
  const size = density || chart_density();
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState({ k: 1, x: 0, y: 0, smooth: true });
  const [hover, setHover] = useState(null);
  const drag_ref = useRef(null);
  const frame_ref = useRef(null);

  const names = useMemo(() => (rows || []).map((row) => row.label).filter(Boolean), [rows]);
  const names_key = names.join("|");

  useEffect(() => {
    if (!fetch_shapes) {
      setState({ loading: false, error: translate("DCS_DB_MAP_NO_SOURCE"), data: null });
      return undefined;
    }
    let is_mounted = true;
    setState((current) => ({ loading: true, error: "", data: current.data }));
    Promise.resolve(fetch_shapes(level, names))
      .then((response) => {
        const data = (response && response.data) || response || null;
        if (is_mounted) setState({ loading: false, error: data ? "" : translate("DCS_DB_MAP_FAILED"), data });
      })
      .catch(() => is_mounted && setState({ loading: false, error: translate("DCS_DB_MAP_FAILED"), data: null }));
    return () => {
      is_mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, names_key, attempt]);

  const height = Math.max(220, size.height + 60);
  const width = Math.max(240, size.width - 8);
  const data = state.data;

  // The whole city always fits the box, whatever the widget itself covers,
  // so two maps of the same board line up.
  const projection = useMemo(() => {
    const frame = data ? (data.parents || []).reduce((best, entry) => best.concat(entry.shapes), (data.shapes || []).slice()) : [];
    return make_projection(bounds_of(frame), width, height, 10);
  }, [data, width, height]);

  // What one place is worth: its own number, or - when the map is split
  // into values - the sum of them, which the split rows never carry.
  const values = useMemo(() => {
    const keys = Array.isArray(series) ? series : [];
    const total_of = (row) => {
      if (row.value !== undefined && row.value !== null && Number.isFinite(Number(row.value))) return Number(row.value);
      return keys.reduce((sum, key) => sum + (Number(row[key]) || 0), 0);
    };
    const map = new Map();
    (rows || []).forEach((row) => map.set(map_key(row.label), { ...row, value: total_of(row) }));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, (series || []).join("|")]);
  // Split into values (status, gender): each value has its own color and
  // marker, and a place takes the ones of the value leading it.
  const split_values = Array.isArray(series) ? series : [];
  const has_split = split_values.length > 0;
  const value_color = (value) => colors.color_override(value) || colors.color_for(value, split_values.indexOf(value));
  // Every boundary keeps a color of its own, split or not - the colors of
  // the split belong to its markers and its legend, not to the land. A
  // color set on the widget's appearance for that place always wins.
  // A shape answers to the name the widget asked for, which is what its
  // rows are labelled with - the boundary's own spelling can differ.
  const key_of = (shape) => map_key(shape.asked || shape.name);
  // One color per place NAME, so the several villages that share a name
  // share its color and its legend entry.
  const name_index = new Map();
  (rows || []).forEach((row, index) => {
    if (!name_index.has(map_key(row.label))) name_index.set(map_key(row.label), index);
  });
  const color_of = (shape) => colors.color_override(shape.name) || spread_color(name_index.has(key_of(shape)) ? name_index.get(key_of(shape)) : 0);
  // What one place is worth in each value, largest first, zeroes dropped.
  const parts_of = (shape) => {
    const row = values.get(key_of(shape));
    if (!row || !has_split) return [];
    return split_values
      .map((value) => ({ value, count: Number(row[value]) || 0 }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count);
  };
  const value_of = (shape) => {
    const row = values.get(key_of(shape));
    return row ? row.value : null;
  };

  // Whatever the viewer does, the drawing keeps covering the frame: at rest
  // it sits centred, and zoomed in it cannot be dragged past its own edge.
  const clamp = (k, x, y) => ({
    x: Math.min(0, Math.max(width * (1 - k), x)),
    y: Math.min(0, Math.max(height * (1 - k), y)),
  });
  const move = (next) => setView((current) => ({ ...current, ...next, ...clamp(current.k, next.x === undefined ? current.x : next.x, next.y === undefined ? current.y : next.y) }));
  // The buttons zoom on the middle of the frame, so the city stays put.
  const zoom_by = (factor) =>
    setView((current) => {
      const k = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current.k * factor));
      const ratio = k / current.k;
      const cx = width / 2;
      const cy = height / 2;
      return { k, ...clamp(k, cx - (cx - current.x) * ratio, cy - (cy - current.y) * ratio), smooth: true };
    });

  // React attaches wheel listeners passively, so the map registers its own
  // and keeps the page from scrolling while the pointer zooms the city.
  useEffect(() => {
    const frame = frame_ref.current;
    if (!frame) return undefined;
    const on_wheel = (event) => {
      event.preventDefault();
      // The wheel zooms on the middle of the frame, like the buttons, so the
      // city grows in place instead of sliding off under the pointer.
      const cx = width / 2;
      const cy = height / 2;
      setView((current) => {
        const k = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current.k * (event.deltaY < 0 ? 1.15 : 1 / 1.15)));
        const ratio = k / current.k;
        return { k, ...clamp(k, cx - (cx - current.x) * ratio, cy - (cy - current.y) * ratio), smooth: false };
      });
    };
    frame.addEventListener("wheel", on_wheel, { passive: false });
    return () => frame.removeEventListener("wheel", on_wheel);
  }, [state.loading, state.error, width, height]);

  const on_down = (event) => {
    drag_ref.current = { x: event.clientX - view.x, y: event.clientY - view.y, moved: false };
  };
  const on_move = (event) => {
    if (!drag_ref.current) return;
    drag_ref.current.moved = true;
    move({ x: event.clientX - drag_ref.current.x, y: event.clientY - drag_ref.current.y, smooth: false });
  };
  const on_up = () => {
    drag_ref.current = null;
  };

  if (state.loading && !data) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <SpiralLoader />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 text-center px-3" style={{ height }}>
        <p className="text-xs font-semibold" style={{ color: colors.text }}>
          {state.error || translate("DCS_DB_MAP_FAILED")}
        </p>
        <button type="button" className="dcs-map-retry" style={{ color: colors.number, borderColor: colors.border }} onClick={() => setAttempt((current) => current + 1)}>
          {translate("DCS_DB_RETRY")}
        </button>
      </div>
    );
  }

  const parents = data.parents || [];
  const parent_color = (name, index) => colors.color_for(name, index + 3);
  // The place under the pointer: kept as the shape itself, not as its name,
  // because several places can carry one name and only the chain above them
  // says which is which.
  const hover_row = hover ? values.get(map_key(hover.asked || hover.name)) || null : null;
  const transform = `translate(${view.x}px, ${view.y}px) scale(${view.k})`;
  const tool_style = { backgroundColor: colors.background, borderColor: colors.border, color: colors.text };
  const screen = (point) => {
    const [px, py] = projection.point(point);
    return [px * view.k + view.x, py * view.k + view.y];
  };

  // A name is written only where it fits inside its own boundary, both
  // across and down, at the current zoom - zooming in reveals the rest.
  const label_font = Math.max(8, size.font - 1);
  const label_text = (shape) => {
    const value = value_of(shape);
    return showMarkers || value === null ? shape.name : `${shape.name} ${Number(value).toLocaleString("en-US")}`;
  };
  const fits = (shape, needed_w, needed_h) => shape_width(shape, projection) * view.k >= needed_w && shape_height(shape, projection) * view.k >= needed_h;
  const fits_label = (shape) => fits(shape, label_text(shape).length * label_font * LETTER_WIDTH + 6, label_font * 1.5 + (showMarkers ? 20 : 0));
  const labels = showLabels === false ? [] : (data.shapes || []).filter(fits_label);
  const markers = showMarkers ? data.shapes || [] : [];
  const mark_size = Math.max(12, Math.round(size.font * 1.3));
  const marker_icon = marker || MARKER_SET[0];
  // Text sits over colored land, so it carries a halo of the widget's own
  // background - that is what keeps it readable in either theme.
  const halo = `0 0 3px ${colors.background}, 0 0 2px ${colors.background}, 0 0 1px ${colors.background}`;
  // What one place plants: one mark per value it holds, or its own total.
  const marks_of = (shape) => {
    const parts = parts_of(shape);
    if (parts.length > 0) return parts.map((part) => ({ key: part.value, color: value_color(part.value), count: part.count }));
    const total = value_of(shape);
    return total === null ? [] : [{ key: shape.name, color: color_of(shape), count: total }];
  };

  // The legend: the split values and their totals, or the places themselves.
  const legend_items = has_split
    ? split_values.map((value) => ({
        key: value,
        name: value,
        color: value_color(value),
        icon: showMarkers ? marker_icon : null,
        is_value: true,
        value: (rows || []).reduce((sum, row) => sum + (Number(row[value]) || 0), 0),
      }))
    : (rows || []).map((row) => ({ key: row.label, name: row.label, color: colors.color_override(row.label) || spread_color(name_index.get(map_key(row.label)) || 0), value: row.value }));
  const pick_legend = (item) => {
    if (item.is_value) {
      if (onLegendClick) onLegendClick({ label: item.name });
    } else if (onItemClick) {
      onItemClick({ label: item.name });
    }
  };

  return (
    <div>
      <div
        ref={frame_ref}
        className="dcs-map-frame dcs-no-drill"
        style={{ height, borderColor: colors.border }}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={on_down}
        onMouseMove={on_move}
        onMouseUp={on_up}
        onMouseLeave={() => {
          on_up();
          setHover(null);
        }}
      >
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="dcs-map-svg" style={{ transform, transition: view.smooth ? "transform 260ms ease" : "none" }}>
          {parents
            .slice()
            .reverse()
            .map((entry, level_index) =>
              entry.shapes.map((shape, index) => (
                <path
                  key={`${entry.level}-${shape.name}-${index}`}
                  d={projection.path(shape.rings)}
                  fill={with_alpha(parent_color(shape.name, index + level_index), 0.06)}
                  stroke={parent_color(shape.name, index + level_index)}
                  strokeWidth={(2.2 - level_index * 0.5) / view.k}
                  strokeLinejoin="round"
                />
              )),
            )}
          {(data.shapes || []).map((shape, index) => {
            const answered = value_of(shape) !== null;
            const active = hover !== null && hover.id === index;
            return (
              <path
                key={`${shape.name}-${index}`}
                d={projection.path(shape.rings)}
                fill={with_alpha(color_of(shape), answered ? (active ? 0.92 : 0.7) : 0.16)}
                stroke={active ? "#FFFFFF" : with_alpha(colors.text, 0.4)}
                strokeWidth={(active ? 3 : 0.8) / view.k}
                className={animate === false ? undefined : "dcs-map-shape"}
                style={{ animationDelay: `${Math.min(index * 12, 600)}ms`, cursor: onItemClick ? "pointer" : "default" }}
                onMouseEnter={() => setHover({ id: index, name: shape.name, asked: shape.asked, path: shape.path || [] })}
                onClick={(event) => {
                  event.stopPropagation();
                  if (drag_ref.current && drag_ref.current.moved) return;
                  if (onItemClick) onItemClick({ label: shape.name });
                }}
              />
            );
          })}
        </svg>

        <div className="dcs-map-overlay">
          {labels.map((shape, index) => {
            const point = anchor_of(shape);
            if (!point) return null;
            const [px, py] = screen(point);
            return (
              <span key={`${shape.name}-${index}`} className={`dcs-map-label ${showMarkers ? "is-below" : ""}`} style={{ left: px, top: py, color: colors.text, fontSize: label_font, textShadow: halo }}>
                {label_text(shape)}
              </span>
            );
          })}
          {markers.map((shape, index) => {
            const point = anchor_of(shape);
            if (!point) return null;
            const marks = marks_of(shape);
            // A mark that does not fit its own boundary is left out rather
            // than laid over the next place and its name.
            if (marks.length === 0 || !fits(shape, marks.length * (mark_size + 20) + 4, mark_size + 4)) return null;
            const [px, py] = screen(point);
            // Nothing but the icon and the number - no card around them.
            return (
              <span key={`marker-${shape.name}-${index}`} className="dcs-map-marker" style={{ left: px, top: py }}>
                {marks.map((mark) => (
                  <span key={mark.key} className="dcs-map-mark">
                    <LibraryIcon icon={marker_icon} size={mark_size} color={mark.color} />
                    <b style={{ color: colors.text, textShadow: halo }}>{Number(mark.count).toLocaleString("en-US")}</b>
                  </span>
                ))}
              </span>
            );
          })}
        </div>

        <div className="dcs-map-tools">
          <button type="button" style={tool_style} title={translate("DCS_DB_MAP_ZOOM_IN")} onClick={() => zoom_by(1.4)}>
            +
          </button>
          <button type="button" style={tool_style} title={translate("DCS_DB_MAP_ZOOM_OUT")} onClick={() => zoom_by(1 / 1.4)}>
            -
          </button>
          <button type="button" className="dcs-map-reset" style={tool_style} title={translate("DCS_DB_MAP_RESET")} onClick={() => setView({ k: 1, x: 0, y: 0, smooth: true })}>
            {translate("DCS_DB_MAP_RESET")}
          </button>
        </div>

        {hover && (
          <div className="dcs-map-tip" style={{ backgroundColor: colors.tooltip.backgroundColor, color: colors.tooltip_text.color, borderColor: colors.border }}>
            <b>{hover.name}</b>
            {hover.path.length > 0 && <span className="dcs-map-tip-path">{hover.path.join(" / ")}</span>}
            <span>{hover_row ? Number(hover_row.value).toLocaleString("en-US") : translate("DCS_DB_MAP_NO_VALUE")}</span>
            {has_split && hover_row && (
              <span className="dcs-map-tip-values">
                {split_values
                  .filter((value) => (Number(hover_row[value]) || 0) > 0)
                  .map((value) => (
                    <span key={value} className="dcs-map-tip-value">
                      <span className="dcs-map-legend-swatch" style={{ borderColor: value_color(value), backgroundColor: value_color(value) }} />
                      {value} {Number(hover_row[value]).toLocaleString("en-US")}
                    </span>
                  ))}
              </span>
            )}
          </div>
        )}
      </div>

      <MapLegend items={legend_items} palette={colors} onPick={onItemClick || onLegendClick ? pick_legend : null} unknown={data.unknown || []} />
    </div>
  );
}
