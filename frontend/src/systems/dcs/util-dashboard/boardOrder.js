export const is_ordered = (layout) => !!(layout && layout.ordered === true);

const parent_of = (widget) => widget.parent_id || null;

const is_kpi = (widget) => widget.chart_type === "kpi";

export function siblings_of(widgets, layout, parent_id) {
  const list = widgets.filter((widget) => parent_of(widget) === (parent_id || null));
  if (parent_id || is_ordered(layout)) return list;
  return list.filter(is_kpi).concat(list.filter((widget) => !is_kpi(widget)));
}

export const board_order = (widgets, layout) => siblings_of(widgets, layout, null);

function walk(widgets, layout, parent_id, override, out, seen) {
  const list = override && override.parent_id === (parent_id || null) ? override.list : siblings_of(widgets, layout, parent_id);
  list.forEach((widget) => {
    if (seen.has(widget.id)) return;
    seen.add(widget.id);
    out.push(widget);
    walk(widgets, layout, widget.id, override, out, seen);
  });
}

export function arranged_widgets(widgets, layout, override) {
  const out = [];
  const seen = new Set();
  walk(widgets, layout, null, override, out, seen);
  widgets.forEach((widget) => {
    if (seen.has(widget.id)) return;
    seen.add(widget.id);
    out.push(widget);
  });
  return out.map((widget, index) => ({ ...widget, position: index }));
}

export function position_of(widgets, layout, widget) {
  if (!widget) return { index: -1, count: 0 };
  const list = siblings_of(widgets, layout, parent_of(widget));
  return { index: list.findIndex((entry) => entry.id === widget.id), count: list.length };
}

export function clamp_position(value, count) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number) || count < 1) return 1;
  return Math.min(Math.max(number, 1), count);
}

export function move_widget(widgets, layout, widget_id, position) {
  const target = widgets.find((widget) => widget.id === widget_id);
  if (!target) return arranged_widgets(widgets, layout);
  const parent_id = parent_of(target);
  const list = siblings_of(widgets, layout, parent_id).filter((widget) => widget.id !== widget_id);
  const at = clamp_position(position, list.length + 1) - 1;
  list.splice(at, 0, target);
  return arranged_widgets(widgets, layout, { parent_id, list });
}
