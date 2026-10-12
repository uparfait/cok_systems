export const GEO_PARTS = ["latitude", "longitude", "accuracy"];

export const LINE_COLORS = ["#056daa", "#E67E22", "#27AE60", "#8E44AD", "#C0392B", "#16A085", "#D35400", "#2C3E50", "#7F8C8D", "#F39C12", "#1ABC9C", "#9B59B6"];

export const target_key = (field_id, part) => (part ? `${field_id}:${part}` : field_id);

export function build_targets(fields, translate) {
  const targets = [];
  (fields || []).forEach((field) => {
    targets.push({ key: target_key(field.id), field, part: null, label: field.label, required: field.required });
    if (field.type === "geolocation") {
      GEO_PARTS.forEach((part) => {
        targets.push({ key: target_key(field.id, part), field, part, label: translate(`DCS_IMPORT_PART_${part.toUpperCase()}`), required: field.required && part !== "accuracy" });
      });
    }
  });
  return targets;
}

export const normalize_name = (text) => String(text || "").trim().toLowerCase().replace(/[\s_\-]+/g, " ");

export function auto_map(headers, targets) {
  const mapping = {};
  const used = new Set();
  const by_name = new Map();
  (headers || []).forEach((header, index) => {
    const name = normalize_name(header);
    if (name && !by_name.has(name)) by_name.set(name, index);
  });
  const claim = (target, column) => {
    if (column === undefined || used.has(column)) return;
    mapping[target.key] = column;
    used.add(column);
  };
  targets.forEach((target) => {
    const names = target.field.names && target.field.names.length > 0 ? target.field.names : [target.field.label, target.field.id];
    if (target.part) {
      for (const base of names) {
        const column = by_name.get(normalize_name(`${base} ${target.part}`));
        if (column !== undefined) {
          claim(target, column);
          break;
        }
      }
      return;
    }
    if (target.field.type === "geolocation") return;
    for (const name of names) {
      const column = by_name.get(normalize_name(name));
      if (column !== undefined) {
        claim(target, column);
        break;
      }
    }
  });
  return mapping;
}

export function color_of(targets, key) {
  const index = targets.findIndex((target) => target.key === key);
  return LINE_COLORS[(index < 0 ? 0 : index) % LINE_COLORS.length];
}

export function is_target_mapped(mapping, target) {
  if (target.part) return mapping[target.key] !== undefined;
  if (target.field.type !== "geolocation") return mapping[target.key] !== undefined;
  return mapping[target.key] !== undefined || (mapping[target_key(target.field.id, "latitude")] !== undefined && mapping[target_key(target.field.id, "longitude")] !== undefined);
}

export function required_unmapped(mapping, targets) {
  return targets.filter((target) => !target.part && target.required && !is_target_mapped(mapping, target)).map((target) => target.label);
}

export function mapping_rows(mapping, targets) {
  return targets
    .filter((target) => mapping[target.key] !== undefined)
    .map((target) => ({ column: mapping[target.key], field_id: target.field.id, part: target.part }));
}

export function header_text(headers, index, translate) {
  const text = headers[index];
  return text && text.trim() ? text : translate("DCS_IMPORT_COLUMN_N", { n: index + 1 });
}

