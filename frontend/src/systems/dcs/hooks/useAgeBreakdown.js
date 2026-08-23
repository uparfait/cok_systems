import { useEffect, useMemo, useState } from "react";

const COUNT_DURATION_MS = 1800;

const ZERO_BREAKDOWN = { years: 0, months: 0, weeks: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };

/**
 * Splits the time between two dates into calendar years and months, then
 * weeks/days/hours/minutes/seconds of whatever remains - an exact live age
 * ("2 yrs 3 mos 1 wk 4 days ...") rather than a single rounded duration.
 */
function compute_elapsed_breakdown(created_date, now_date) {
  let years = now_date.getFullYear() - created_date.getFullYear();
  let months = now_date.getMonth() - created_date.getMonth();
  let days = now_date.getDate() - created_date.getDate();
  let hours = now_date.getHours() - created_date.getHours();
  let minutes = now_date.getMinutes() - created_date.getMinutes();
  let seconds = now_date.getSeconds() - created_date.getSeconds();

  if (seconds < 0) {
    seconds += 60;
    minutes -= 1;
  }
  if (minutes < 0) {
    minutes += 60;
    hours -= 1;
  }
  if (hours < 0) {
    hours += 24;
    days -= 1;
  }
  if (days < 0) {
    const days_in_previous_month = new Date(now_date.getFullYear(), now_date.getMonth(), 0).getDate();
    days += days_in_previous_month;
    months -= 1;
  }
  if (months < 0) {
    months += 12;
    years -= 1;
  }

  const weeks = Math.floor(days / 7);
  const remaining_days = days % 7;

  return {
    years: Math.max(0, years),
    months: Math.max(0, months),
    weeks: Math.max(0, weeks),
    days: Math.max(0, remaining_days),
    hours: Math.max(0, hours),
    minutes: Math.max(0, minutes),
    seconds: Math.max(0, seconds),
  };
}

/**
 * Live-ticking breakdown of how long ago a date was - a project's or a
 * form's own created_at, anything with a fixed origin. Recomputes every
 * second from the real clock (so it's always exact, never drifting), and
 * the moment `active` turns true (driven by useScrollReveal, the same
 * trigger the About page's own stat counters use) every unit counts up from
 * zero to its real current value once, matching how counting already works
 * elsewhere in DCS, before settling into normal live ticking.
 */
export function useAgeBreakdown(created_at, active) {
  const created_date = useMemo(() => new Date(created_at), [created_at]);
  const [now, setNow] = useState(() => new Date());
  const [displayed, setDisplayed] = useState(ZERO_BREAKDOWN);
  const [is_counting, setIsCounting] = useState(false);

  useEffect(() => {
    const interval_id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval_id);
  }, []);

  const real_breakdown = compute_elapsed_breakdown(created_date, now);

  useEffect(() => {
    if (!active) return undefined;

    setIsCounting(true);
    let frame_id = null;
    const start_time = performance.now();
    const target = compute_elapsed_breakdown(created_date, new Date());

    const tick = (frame_time) => {
      const progress = Math.min(1, (frame_time - start_time) / COUNT_DURATION_MS);
      const eased_progress = 1 - (1 - progress) * (1 - progress);
      setDisplayed({
        years: Math.round(target.years * eased_progress),
        months: Math.round(target.months * eased_progress),
        weeks: Math.round(target.weeks * eased_progress),
        days: Math.round(target.days * eased_progress),
        hours: Math.round(target.hours * eased_progress),
        minutes: Math.round(target.minutes * eased_progress),
        seconds: Math.round(target.seconds * eased_progress),
      });
      if (progress < 1) {
        frame_id = requestAnimationFrame(tick);
      } else {
        setIsCounting(false);
      }
    };

    frame_id = requestAnimationFrame(tick);
    return () => {
      if (frame_id) cancelAnimationFrame(frame_id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, created_date]);

  return is_counting ? displayed : real_breakdown;
}
