export const is_ordered = (layout) => !!(layout && layout.ordered === true);

const parent_of = (widget) => widget.parent_id || null;

export function hidden_by_filters(entry) {
  if (!entry || entry.error || entry.locked || !Array.isArray(entry.board_context) || entry.board_context.length === 0) return false;
  if (entry.kind === "table") return false;
  if (entry.kind === "kpi") return !(Number(entry.value) > 0) && !(Array.isArray(entry.legend) && entry.legend.length > 0);
  const has = (list) => Array.isArray(list) && list.length > 0;
  return !has(entry.rows) && !has(entry.points) && !has(entry.nodes) && !has(entry.items);
}

export function siblings_of(widgets, layout, parent_id) {
  const rank = (widget, index) => (Number.isInteger(widget.position) ? widget.position : index);
  return widgets
    .map((widget, index) => ({ widget, index }))
    .filter(({ widget }) => parent_of(widget) === (parent_id || null))
    .sort((a, b) => rank(a.widget, a.index) - rank(b.widget, b.index) || a.index - b.index)
    .map(({ widget }) => widget);
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

const drawn = (list, is_hidden, keep_id) => list.filter((widget) => widget.id === keep_id || !(is_hidden && is_hidden(widget)));

export function position_of(widgets, layout, widget, is_hidden) {
  if (!widget) return { index: -1, count: 0 };
  const list = drawn(siblings_of(widgets, layout, parent_of(widget)), is_hidden, widget.id);
  return { index: list.findIndex((entry) => entry.id === widget.id), count: list.length };
}

export function clamp_position(value, count) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number) || count < 1) return 1;
  return Math.min(Math.max(number, 1), count);
}

export function move_widget(widgets, layout, widget_id, position, is_hidden) {
  const target = widgets.find((widget) => widget.id === widget_id);
  if (!target) return arranged_widgets(widgets, layout);
  const parent_id = parent_of(target);
  const rest = siblings_of(widgets, layout, parent_id).filter((widget) => widget.id !== widget_id);
  const shown = drawn(rest, is_hidden, null);
  const at = clamp_position(position, shown.length + 1) - 1;
  const index = at < shown.length ? rest.indexOf(shown[at]) : shown.length > 0 ? rest.indexOf(shown[shown.length - 1]) + 1 : rest.length;
  const list = rest.slice();
  list.splice(index, 0, target);
  return arranged_widgets(widgets, layout, { parent_id, list });
}
