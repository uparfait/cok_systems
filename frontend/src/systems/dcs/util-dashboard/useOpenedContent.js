import { useEffect, useState } from "react";

/**
 * Whether the content of a widget's area has been OPENED OUT: a chart
 * showing all of its values, the folded "Other" rows, a KPI or map legend
 * past its first rows. The charts keep that state to themselves, so the
 * card reads it off the area: an opened list is the one whose link now
 * offers to fold it back. Read again on every change inside the area.
 */
export function useOpenedContent(area_ref, open_texts, active) {
  const [open, setOpen] = useState(false);
  const key = open_texts.join("|");
  useEffect(() => {
    const area = area_ref.current;
    if (!active || !area || typeof MutationObserver === "undefined") {
      setOpen(false);
      return undefined;
    }
    const texts = key.split("|");
    const read = () => {
      const next = Array.from(area.querySelectorAll("button")).some((button) => texts.includes((button.textContent || "").trim()));
      setOpen((current) => (current === next ? current : next));
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(area, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [area_ref, key, active]);
  return open;
}
