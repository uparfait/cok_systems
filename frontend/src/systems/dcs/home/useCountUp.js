import { useEffect, useState } from "react";

const COUNT_DURATION_MS = 4000;

/**
 * Splits a stat string like "20+" or "100%" into its counted number and the
 * prefix/suffix text around it, so "20+" can animate 0 -> 20 while still
 * rendering the "+" it ends with. A stat with no digits at all (e.g. the
 * word "Versioned") has nothing to count - is_numeric is false and callers
 * should just render the raw text unanimated.
 */
function parse_countable_value(raw_value) {
  const match = /^(\D*)(\d+)(\D*)$/.exec(String(raw_value));
  if (!match) return { is_numeric: false, prefix: "", target: 0, suffix: String(raw_value) };
  const [, prefix, digits, suffix] = match;
  return { is_numeric: true, prefix, target: Number(digits), suffix };
}

/**
 * Animates a numeric stat counting up from 0 to its real value over at
 * least COUNT_DURATION_MS using an ease-out curve, starting only once
 * `active` turns true (driven by useScrollReveal, so it counts up exactly
 * once as the stat scrolls into view rather than looping or firing before
 * it's visible). `done` flips to true the instant it reaches its real
 * value, so a caller can trigger a one-off "arrived" celebration exactly
 * once, right as the count finishes - never on every re-render.
 */
export function useCountUp(raw_value, active) {
  const { is_numeric, prefix, target, suffix } = parse_countable_value(raw_value);
  const [displayed, setDisplayed] = useState(is_numeric ? 0 : target);
  const [done, setDone] = useState(!is_numeric);

  useEffect(() => {
    if (!is_numeric || !active) return undefined;

    let frame_id = null;
    const start_time = performance.now();

    const tick = (now) => {
      const progress = Math.min(1, (now - start_time) / COUNT_DURATION_MS);
      const eased_progress = 1 - (1 - progress) * (1 - progress);
      setDisplayed(Math.round(target * eased_progress));
      if (progress < 1) {
        frame_id = requestAnimationFrame(tick);
      } else {
        setDone(true);
      }
    };

    frame_id = requestAnimationFrame(tick);
    return () => {
      if (frame_id) cancelAnimationFrame(frame_id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, is_numeric, target]);

  const text = is_numeric ? `${prefix}${displayed}${suffix}` : suffix;
  return { text, done };
}
