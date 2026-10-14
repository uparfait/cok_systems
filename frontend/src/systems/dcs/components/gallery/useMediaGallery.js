import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_PERIOD = "this_year";
const MAX_PAGE_SIZE = 60;
const GRID_GAP_PX = 8;
const CHROME_HEIGHT_PX = 180;

function viewport_page_size() {
  const width = Math.min(window.innerWidth, 1600) - 32;
  const cols = width < 480 ? 2 : width < 720 ? 3 : width < 1000 ? 4 : width < 1320 ? 5 : 6;
  const tile = width / cols + GRID_GAP_PX;
  const rows = Math.ceil(Math.max(320, window.innerHeight - CHROME_HEIGHT_PX) / tile) + 1;
  return Math.min(MAX_PAGE_SIZE, Math.max(cols * 2, cols * rows));
}

export function useMediaGallery(fetcher, scope_key) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [has_more, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const loading_ref = useRef(false);
  const applied_ref = useRef({ period: DEFAULT_PERIOD, from: "", to: "" });
  const page_size_ref = useRef(viewport_page_size());

  const fetch_page = useCallback(
    (next_page, params, replace) => {
      if (loading_ref.current) return;
      if (params.period === "custom" && !params.from) return;
      loading_ref.current = true;
      setLoading(true);
      applied_ref.current = params;
      if (replace) page_size_ref.current = viewport_page_size();
      fetcher(next_page, page_size_ref.current, params)
        .then((response) => {
          const batch = response.data || [];
          setItems((current) => (replace ? batch : current.concat(batch)));
          setTotal(response.total || 0);
          setHasMore(response.has_more === true);
          setPage(next_page);
        })
        .catch(() => {
          if (replace) setItems([]);
          setHasMore(false);
        })
        .finally(() => {
          loading_ref.current = false;
          setLoading(false);
        });
    },
    [fetcher],
  );

  useEffect(() => {
    if (period === "custom") return;
    setFrom("");
    setTo("");
    setItems([]);
    setHasMore(true);
    fetch_page(1, { period, from: "", to: "" }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, scope_key]);

  const handle_apply = (applied_from, applied_to) => {
    const next_from = typeof applied_from === "string" ? applied_from : from;
    const next_to = typeof applied_to === "string" ? applied_to : to;
    if (period === "custom" && !next_from) return;
    setItems([]);
    setHasMore(true);
    fetch_page(1, { period, from: next_from, to: next_to }, true);
  };

  const load_more = () => fetch_page(page + 1, applied_ref.current, false);

  return {
    items,
    total,
    has_more,
    loading,
    is_first_load: loading && items.length === 0,
    page_size: page_size_ref.current,
    period,
    setPeriod,
    from,
    setFrom,
    to,
    setTo,
    handle_apply,
    load_more,
  };
}
