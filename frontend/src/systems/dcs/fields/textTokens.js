/**
 * A paragraph or heading can quote a live answer by naming the field in
 * double braces - "{{hidden_count}} of 7 criteria confirmed" - so a note
 * can state a derived total instead of a person having to work it out.
 * Tokens are replaced with the current values at render time; a field with
 * no answer yet reads as blank rather than as its own name.
 */
export const TEXT_TOKEN_PATTERN = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;

export function has_text_tokens(text) {
  return typeof text === "string" && text.includes("{{");
}

export function token_value(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(token_value).filter((part) => part !== "").join(", ");
  if (typeof value === "number") return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : "";
  if (typeof value === "object") return "";
  return String(value);
}

/**
 * Replaces every token in the text and moves the author's link ranges so
 * they still cover the same words once the text has grown or shrunk.
 */
export function fill_text_tokens(text, links, values) {
  const source = text || "";
  const safe_links = (links || []).map((link) => Object.assign({}, link));
  if (!has_text_tokens(source)) return { text: source, links: safe_links };

  let filled = "";
  let cursor = 0;
  source.replace(TEXT_TOKEN_PATTERN, (match, field_id, at) => {
    const replacement = token_value(values ? values[field_id] : undefined);
    filled += source.slice(cursor, at) + replacement;
    const token_end = at + match.length;
    const delta = replacement.length - match.length;
    safe_links.forEach((link) => {
      if (link.start >= token_end) {
        link.start += delta;
        link.end += delta;
      } else if (link.end >= token_end) {
        link.end += delta;
      } else if (link.end > at) {
        link.end = Math.min(link.end, at + replacement.length);
      }
    });
    cursor = token_end;
    return match;
  });
  filled += source.slice(cursor);
  return { text: filled, links: safe_links.filter((link) => link.end > link.start) };
}
