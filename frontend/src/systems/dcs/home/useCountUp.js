import { useEffect, useRef, useState } from "react";

const COUNT_DURATION_MS = 2800;
// A number that only moved a little should not take the full sweep a
// first count from zero takes: the run is scaled by how far it travels,
// down to this floor, so changing a filter reads as a quick adjustment
// rather than another long animation.
const MIN_COUNT_DURATION_MS = 450;
const FULL_SWEEP_DISTANCE = 60;

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
 * Animates a numeric stat toward its real value over an ease-out curve,
 * starting only once `active` turns true (driven by useScrollReveal, so
 * it counts up exactly once as the stat scrolls into view rather than
 * looping or firing before it's visible). `done` flips to true the
 * instant it reaches its real value, so a caller can trigger a one-off
 * "arrived" celebration exactly once, right as the count finishes.
 *
 * It counts FROM WHATEVER IS ON SCREEN, not from zero. The first count of
 * a freshly mounted stat does start at zero because that is what is
 * showing, but a stat that already reads 12 and is then told it is 45
 * climbs 12 -> 45, and one told it is 5 falls 12 -> 5. Dropping back to
 * zero and racing up again on every change of a date filter read as the
 * number being lost and recounted rather than simply moving.
 */
export function useCountUp(raw_value, active) {
  const { is_numeric, prefix, target, suffix } = parse_countable_value(raw_value);
  const [displayed, setDisplayed] = useState(is_numeric ? 0 : target);
  const [done, setDone] = useState(!is_numeric);
  // Read inside the animation only, so a frame updating `displayed` never
  // restarts the run it is part of.
  const displayed_ref = useRef(displayed);
  displayed_ref.current = displayed;

  useEffect(() => {
    if (!is_numeric || !active) return undefined;

    const from = displayed_ref.current;
    const distance = Math.abs(target - from);
    if (distance === 0) {
      setDone(true);
      return undefined;
    }

    setDone(false);
    const duration = Math.max(
      MIN_COUNT_DURATION_MS,
      Math.round(COUNT_DURATION_MS * Math.min(1, distance / FULL_SWEEP_DISTANCE)),
    );

    let frame_id = null;
    const start_time = performance.now();

    const tick = (now) => {
      const progress = Math.min(1, (now - start_time) / duration);
      const eased_progress = 1 - (1 - progress) * (1 - progress);
      setDisplayed(Math.round(from + (target - from) * eased_progress));
      if (progress < 1) {
        frame_id = requestAnimationFrame(tick);
      } else {
        setDisplayed(target);
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
