/**
 * Takes the respondent to the question that stopped their submit.
 *
 * A form can be long and the missing answer can be anywhere in it - above
 * where they are reading as often as below - so telling them "fix the
 * highlighted fields" and leaving them where they stand is no answer at
 * all. The NEAREST unanswered question wins, measured from the middle of
 * what they are looking at right now, because that is the one they were
 * closest to finishing.
 *
 * Every rendered field carries its id on its wrapper (see RendererEngine),
 * which is what is looked up here - a field that is currently hidden has
 * no wrapper on the page and is simply skipped.
 */

/** The first thing inside a field that a respondent can actually type into. */
const FOCUSABLE = "input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [role=button]:not([aria-disabled=true])";

export function scroll_to_first_error(field_ids) {
  if (typeof document === "undefined" || !Array.isArray(field_ids) || field_ids.length === 0) return null;
  const middle = (typeof window !== "undefined" ? window.innerHeight : 0) / 2;
  let nearest = null;
  let best = Infinity;
  field_ids.forEach((field_id) => {
    const element = document.querySelector(`[data-field-id="${CSS.escape(String(field_id))}"]`);
    if (!element) return;
    const box = element.getBoundingClientRect();
    // A field that is on the page but drawn as nothing (a question whose
    // conditions currently hide it) is not somewhere to send anyone.
    if (box.height === 0 && box.width === 0) return;
    const distance = Math.abs(box.top + box.height / 2 - middle);
    if (distance < best) {
      best = distance;
      nearest = element;
    }
  });
  if (!nearest) return null;
  nearest.scrollIntoView({ behavior: "smooth", block: "center" });
  // Scrolling shows it; focusing it says which one, and lets a keyboard or
  // a screen reader carry straight on from there. Not stolen from a
  // respondent who is already typing somewhere else.
  const field = nearest.querySelector(FOCUSABLE);
  if (field && document.activeElement === document.body) {
    try {
      field.focus({ preventScroll: true });
    } catch (error) {
      field.focus();
    }
  }
  return nearest;
}
