export function split_text_into_link_segments(text, links) {
  const safe_text = text || "";
  const safe_links = (links || [])
    .filter((link) => link && typeof link.start === "number" && typeof link.end === "number" && link.end > link.start && link.href)
    .slice()
    .sort((a, b) => a.start - b.start);

  const segments = [];
  let cursor = 0;
  safe_links.forEach((link) => {
    const start = Math.max(cursor, Math.min(link.start, safe_text.length));
    const end = Math.max(start, Math.min(link.end, safe_text.length));
    if (start > cursor) segments.push({ text: safe_text.slice(cursor, start), href: null });
    if (end > start) segments.push({ text: safe_text.slice(start, end), href: link.href });
    cursor = Math.max(cursor, end);
  });
  if (cursor < safe_text.length) segments.push({ text: safe_text.slice(cursor), href: null });
  if (segments.length === 0) segments.push({ text: safe_text, href: null });
  return segments;
}

export function split_lines_with_offsets(text) {
  const lines = (text || "").split("\n");
  let offset = 0;
  return lines.map((line) => {
    const start = offset;
    offset += line.length + 1;
    return { line, start, end: start + line.length };
  });
}

export function shift_links_to_range(links, range_start, range_end) {
  return (links || [])
    .map((link) => ({
      start: Math.max(link.start, range_start) - range_start,
      end: Math.min(link.end, range_end) - range_start,
      href: link.href,
    }))
    .filter((link) => link.end > link.start);
}

export function remove_links_overlapping_range(existing_links, start, end) {
  const result = [];
  (existing_links || []).forEach((link) => {
    if (link.end <= start || link.start >= end) {
      result.push(link);
      return;
    }
    if (link.start < start) result.push({ start: link.start, end: start, href: link.href });
    if (link.end > end) result.push({ start: end, end: link.end, href: link.href });
  });
  return result.filter((link) => link.end > link.start);
}

export function add_link_to_range(existing_links, start, end, href) {
  const cleaned = remove_links_overlapping_range(existing_links, start, end);
  return cleaned.concat([{ start, end, href }]).sort((a, b) => a.start - b.start);
}

export function find_link_overlapping_range(existing_links, start, end) {
  return (existing_links || []).find((link) => link.start < end && link.end > start) || null;
}
