import { useEffect, useRef, useState } from "react";

/**
 * True the first time the returned ref's element scrolls into view, and
 * stays true afterward - a section that has already dropped in must never
 * reset and replay every time the respondent scrolls past it again.
 */
export function useScrollReveal(threshold = 0.2) {
  const element_ref = useRef(null);
  const [is_visible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = element_ref.current;
    if (!element) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref: element_ref, isVisible: is_visible };
}
