import { useEffect, useState } from "react";
import { NARROW_PX } from "./freeFlow.js";

/** Whether the window is a phone's width, kept current as it is resized or turned. */
export function useNarrowViewport() {
  const query = `(max-width: ${NARROW_PX - 1}px)`;
  const read = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;
  const [narrow, setNarrow] = useState(read);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia(query);
    const update = () => setNarrow(media.matches);
    update();
    if (media.addEventListener) media.addEventListener("change", update);
    else media.addListener(update);
    return () => {
      if (media.removeEventListener) media.removeEventListener("change", update);
      else media.removeListener(update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return narrow;
}
