const FLASH_CLASS = "dcs-field-flash";
// Matches the dcs-field-flash keyframes in globals.css.
const FLASH_MS = 900;

/**
 * Marks the field rows an undo or redo just changed, so the author can see
 * WHERE the form moved instead of only reading that it did.
 *
 * Driven off the DOM rather than a prop threaded down through the canvas:
 * the rows the animation has to reach include ones nested inside groups
 * and sections, rendered recursively several components deep, and a
 * one-shot animation is not state any of them should have to carry. The
 * flash is applied after a frame so the rows a restored state just brought
 * back have actually been painted first.
 */
export function flash_builder_fields(field_ids) {
  if (!Array.isArray(field_ids) || field_ids.length === 0) return;

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      field_ids.forEach((field_id) => {
        const node = document.querySelector(`[data-builder-field-id="${field_id}"]`);
        if (!node) return;
        node.classList.remove(FLASH_CLASS);
        // Reading offsetWidth restarts the animation on a row that is still
        // mid-flash from a previous step, which re-adding the class alone
        // would not do.
        void node.offsetWidth;
        node.classList.add(FLASH_CLASS);
        window.setTimeout(() => node.classList.remove(FLASH_CLASS), FLASH_MS);
      });

      const first_node = document.querySelector(`[data-builder-field-id="${field_ids[0]}"]`);
      if (first_node && typeof first_node.scrollIntoView === "function") {
        first_node.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  });
}
