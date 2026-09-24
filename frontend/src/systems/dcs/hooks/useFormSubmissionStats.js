import { useEffect, useRef, useState } from "react";
import { get_form_submission_stats } from "../services/formsService.js";

const REFRESH_INTERVAL_MS = 10000;
// The overview opens on the running year: a form's own total means far
// more read against a period than as an all-time number nobody picked.
const DEFAULT_PERIOD = "this_year";

/**
 * The submissions-over-time series of one form, and the total that goes
 * with it. Period, range and result live here rather than inside the
 * chart, because the form overview shows that same total as its own big
 * number beside the chart - one selected period, one total, never two
 * that can drift apart.
 *
 * Refreshes itself silently every 10 seconds using whichever params were
 * last actually applied (tracked in a ref, not the live from/to inputs):
 * a custom range still being typed must never be fetched before Apply.
 */
export function useFormSubmissionStats(form_group_id) {
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const applied_params_ref = useRef({ period: DEFAULT_PERIOD, from: "", to: "" });

  const fetch_stats = (params, silent) => {
    if (params.period === "custom" && !params.from) return;
    applied_params_ref.current = params;
    if (!silent) setLoading(true);
    get_form_submission_stats(form_group_id, {
      period: params.period,
      from: params.period === "custom" ? params.from : undefined,
      to: params.period === "custom" ? params.to : undefined,
    })
      .then((response) => setResult(response.data))
      .catch(() => {
        if (!silent) setResult(null);
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };

  // The custom-range popup hands its just-picked dates straight in: the
  // from/to state is not updated yet at that moment, so reading state
  // here would apply the PREVIOUS range.
  const handle_apply = (applied_from, applied_to) => {
    const next_from = typeof applied_from === "string" ? applied_from : from;
    const next_to = typeof applied_to === "string" ? applied_to : to;
    if (period === "custom" && !next_from) return;
    fetch_stats({ period, from: next_from, to: next_to }, false);
  };

  useEffect(() => {
    if (period !== "custom") {
      setFrom("");
      setTo("");
      fetch_stats({ period, from: "", to: "" }, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, form_group_id]);

  useEffect(() => {
    const interval_id = window.setInterval(() => {
      fetch_stats(applied_params_ref.current, true);
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form_group_id]);

  return {
    period,
    setPeriod,
    from,
    setFrom,
    to,
    setTo,
    handle_apply,
    loading,
    points: (result && result.data) || [],
    total: result ? result.total || 0 : 0,
  };
}
