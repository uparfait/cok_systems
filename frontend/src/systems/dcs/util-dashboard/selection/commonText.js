/**
 * What several widgets' texts have in common, so a bulk edit can change
 * that shared part once: identical texts are edited whole; otherwise the
 * longest common prefix, cut back to a word or separator boundary so
 * "Sum of Amount - Nyagatare" and "Sum of Amount - Gasabo" share
 * "Sum of Amount - " and never "Sum of Amount - N".
 */

const MIN_SHARED = 3;

export function common_prefix(texts) {
  const list = (texts || []).map((text) => String(text || ""));
  if (list.length === 0) return "";
  let prefix = list[0];
  list.slice(1).forEach((text) => {
    let index = 0;
    while (index < prefix.length && index < text.length && prefix[index] === text[index]) index += 1;
    prefix = prefix.slice(0, index);
  });
  if (list.every((text) => text === prefix)) return prefix;
  // Back off to the last boundary so a partial word is never shared.
  const boundary = Math.max(prefix.lastIndexOf(" "), prefix.lastIndexOf("-"), prefix.lastIndexOf(":"), prefix.lastIndexOf("/"), prefix.lastIndexOf("("));
  const cut = boundary >= 0 ? prefix.slice(0, boundary + 1) : "";
  return cut.trim().length >= MIN_SHARED ? cut : "";
}

/** Describes how a set of texts can be edited together. */
export function shared_text(texts) {
  const list = (texts || []).map((text) => String(text || ""));
  if (list.length === 0) return { kind: "none", shared: "" };
  if (list.every((text) => text === list[0])) return { kind: "identical", shared: list[0] };
  const prefix = common_prefix(list);
  return prefix ? { kind: "prefix", shared: prefix } : { kind: "none", shared: "" };
}

/** The text after replacing its shared part (whole text or prefix). */
export function apply_shared(text, description, replacement) {
  const value = String(text || "");
  if (description.kind === "identical") return replacement;
  if (description.kind === "prefix" && value.startsWith(description.shared)) return replacement + value.slice(description.shared.length);
  return value;
}
