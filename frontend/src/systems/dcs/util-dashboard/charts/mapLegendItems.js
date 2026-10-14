import { spread_color } from "../appearance.js";
import { map_key } from "./mapGeometry.js";
import { HEAT_LOW, HEAT_HIGH } from "./heatScale.js";

/**
 * The legend of a map widget. A world map names its places or the values
 * they are split into; a heat map names the values it spreads, or the two
 * ends of its own scale with the lightest and heaviest point on it.
 */
export function map_legend_items({ is_heat, groups, rows, split_values, value_color, colors, name_index, show_markers, marker_icon, low_color, high_color, range, translate }) {
  if (is_heat) {
    if ((groups || []).length > 0) {
      return (groups || []).map((group, index) => ({ key: group.label, name: group.label, color: value_color(group.label, index), value: group.value }));
    }
    return [
      { key: "heat-low", name: translate("DCS_DB_MAP_HEAT_LOW"), color: low_color || HEAT_LOW, value: (range && range.low) || 0 },
      { key: "heat-high", name: translate("DCS_DB_MAP_HEAT_HIGH"), color: high_color || HEAT_HIGH, value: (range && range.high) || 0 },
    ];
  }
  if (split_values.length > 0) {
    return split_values.map((value) => ({
      key: value,
      name: value,
      color: value_color(value),
      icon: show_markers ? marker_icon : null,
      is_value: true,
      value: (rows || []).reduce((sum, row) => sum + (Number(row[value]) || 0), 0),
    }));
  }
  return (rows || []).map((row) => ({
    key: row.label,
    name: row.label,
    color: colors.color_override(row.label) || spread_color(name_index.get(map_key(row.label)) || 0),
    value: row.value,
  }));
}
