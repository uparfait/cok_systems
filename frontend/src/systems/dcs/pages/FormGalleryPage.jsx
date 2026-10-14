import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { get_submission_media } from "../services/submissionsService.js";
import DcsWorkspaceShell from "../components/DcsWorkspaceShell.jsx";
import DcsPeriodFilter from "../components/DcsPeriodFilter.jsx";
import DcsFileViewerModal from "../components/DcsFileViewerModal.jsx";
import DcsEmptyState from "../components/DcsEmptyState.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import { GallerySkeleton } from "../components/DcsSkeletons.jsx";

const DEFAULT_PERIOD = "this_year";
const FONT = "'Montserrat', sans-serif";
const MAX_PAGE_SIZE = 60;
const GRID_GAP_PX = 8;
const CHROME_HEIGHT_PX = 180;

/**
 * How many tiles one page holds: enough to fill the room the grid has on
 * THIS screen and one more row, no fixed ten. The column count follows
 * the grid's own breakpoints, the tile is square, and the height left
 * under the toolbar decides the rows - so a phone asks for a handful and
 * a wide monitor for a full screen, and every "Load more" adds another
 * screenful.
 */
function viewport_page_size() {
  const width = Math.min(window.innerWidth, 1600) - 32;
  const cols = width < 480 ? 2 : width < 720 ? 3 : width < 1000 ? 4 : width < 1320 ? 5 : 6;
  const tile = width / cols + GRID_GAP_PX;
  const rows = Math.ceil(Math.max(320, window.innerHeight - CHROME_HEIGHT_PX) / tile) + 1;
  return Math.min(MAX_PAGE_SIZE, Math.max(cols * 2, cols * rows));
}

const VIDEO_PATTERN = /\.(mp4|webm|mov|m4v|mkv|ogv|avi)(\?|#|$)/i;

function is_video(item) {
  if (item.type && /^video\//i.test(item.type)) return true;
  return VIDEO_PATTERN.test(item.name || item.url || "");
}

/**
 * One tile. A picture loads its own thumbnail and falls back to a plain
 * placeholder if the file is gone; a video shows its first frame through
 * a metadata-only preload, so scrolling the grid never starts downloading
 * whole videos.
 */
function MediaTile({ item, onOpen }) {
  const [failed, setFailed] = useState(false);
  const video = is_video(item);

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      title={item.name || item.field_label}
      className="dcs-gallery-tile cursor-pointer relative block w-full overflow-hidden"
      style={{ aspectRatio: "1 / 1", backgroundColor: "#EEF3F7", border: "1px solid #E0E0E0" }}
    >
      {failed ? (
        <span className="absolute inset-0 flex items-center justify-center" style={{ color: "#9E9E9E" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" />
            <path d="M21 16l-5-5-5.5 5.5L8 14l-5 5" />
          </svg>
        </span>
      ) : video ? (
        <video src={item.url} preload="metadata" muted playsInline className="absolute inset-0 w-full h-full" style={{ objectFit: "cover" }} onError={() => setFailed(true)} />
      ) : (
        <img src={item.url} alt={item.field_label || ""} loading="lazy" className="absolute inset-0 w-full h-full" style={{ objectFit: "cover" }} onError={() => setFailed(true)} />
      )}

      {video && (
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="flex items-center justify-center rounded-full" style={{ width: 34, height: 34, backgroundColor: "rgba(0,0,0,0.55)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#FFFFFF" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
      )}

      <span
        className="absolute left-0 right-0 bottom-0 px-1.5 py-1 text-left truncate"
        style={{ fontFamily: FONT, fontSize: 10, color: "#FFFFFF", background: "linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0))" }}
      >
        {item.field_label || item.name || ""}
      </span>
    </button>
  );
}

/**
 * Every picture and video a form has collected, newest first. A screenful
 * arrives at a time (see viewport_page_size) and the next screenful is
 * asked for by the button at the foot of the grid - an explicit step
 * rather than a grid that keeps growing on its own, so somebody browsing
 * a form with thousands of photos decides how far down they go and can
 * always reach the bottom.
 *
 * Only images and videos are here on purpose: audio and documents have
 * nothing to show in a grid of thumbnails, and the data table already
 * links to them. Opening a tile shows the file at full size, with a way
 * back to the one record it was collected with.
 */
export default function FormGalleryPage() {
  const { project_id, form_group_id } = useParams();
  const { translate } = useDcsLanguage();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [has_more, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // The opened picture lives in the address (?image=) so a refresh, or a
  // shared link, comes back on the very same picture at full size.
  const [search_params, setSearchParams] = useSearchParams();
  const image_url = search_params.get("image") || "";
  const open_item = image_url
    ? items.find((item) => item.url === image_url) || { url: image_url, name: image_url.split("/").pop().split("?")[0], type: "" }
    : null;
  const setOpenItem = (item) => {
    const next = new URLSearchParams(search_params);
    if (item && item.url) next.set("image", item.url);
    else next.delete("image");
    setSearchParams(next, { replace: !item });
  };

  const loading_ref = useRef(false);
  const applied_ref = useRef({ period: DEFAULT_PERIOD, from: "", to: "" });
  // The page size is read from the screen when a page is asked for, so
  // the same size is asked for again on the next one; the skeletons are
  // shaped to it too.
  const page_size_ref = useRef(viewport_page_size());

  const fetch_page = useCallback(
    (next_page, params, replace) => {
      if (loading_ref.current) return;
      if (params.period === "custom" && !params.from) return;
      loading_ref.current = true;
      setLoading(true);
      applied_ref.current = params;
      if (replace) page_size_ref.current = viewport_page_size();
      get_submission_media(form_group_id, next_page, page_size_ref.current, params)
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
    [form_group_id],
  );

  // A new form, or a new range, starts the grid again from the top.
  useEffect(() => {
    if (period === "custom") return;
    setFrom("");
    setTo("");
    setItems([]);
    setHasMore(true);
    fetch_page(1, { period, from: "", to: "" }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, form_group_id]);

  const handle_apply = (applied_from, applied_to) => {
    const next_from = typeof applied_from === "string" ? applied_from : from;
    const next_to = typeof applied_to === "string" ? applied_to : to;
    if (period === "custom" && !next_from) return;
    setItems([]);
    setHasMore(true);
    fetch_page(1, { period, from: next_from, to: next_to }, true);
  };

  const open_in_table = (item) => {
    navigate(`/dcs-system/project/${project_id}/forms/${form_group_id}/data?record=${item.submission_id}`);
  };

  const is_first_load = loading && items.length === 0;

  return (
    <DcsWorkspaceShell
      projectId={project_id}
      formGroupId={form_group_id}
      titleKey="DCS_WS_GALLERY"
      toolbar={
        <>
          <DcsPeriodFilter period={period} onPeriodChange={setPeriod} from={from} onFromChange={setFrom} to={to} onToChange={setTo} onApply={handle_apply} includeAll />
          <span className="text-xs font-semibold flex-shrink-0" style={{ color: "#056daa", fontFamily: FONT }}>
            {translate("DCS_GALLERY_COUNT", { count: total })}
          </span>
        </>
      }
    >
      <div className="bg-white border-2 p-2 sm:p-3" style={{ borderColor: "#E0E0E0" }}>
        {/* Shaped like the grid that is coming, so the page does not jump
            the moment the first ten land. */}
        {is_first_load && <GallerySkeleton count={page_size_ref.current} />}

        {!is_first_load && items.length === 0 && <DcsEmptyState messageKey="DCS_GALLERY_EMPTY" />}

        {items.length > 0 && (
          // Mobile first: two across on the smallest screens, more as
          // there is room, so a tile is never too small to recognise.
          <div className="grid grid-cols-2 min-[480px]:grid-cols-3 min-[720px]:grid-cols-4 min-[1000px]:grid-cols-5 min-[1320px]:grid-cols-6 gap-2">
            {items.map((item) => (
              <MediaTile key={`${item.submission_id}-${item.field_id}-${item.url}`} item={item} onOpen={setOpenItem} />
            ))}
          </div>
        )}

        {loading && items.length > 0 && (
          <div className="mt-2">
            <GallerySkeleton count={Math.min(12, page_size_ref.current)} />
          </div>
        )}

        <div className="flex items-center justify-center py-4">
          {!loading && has_more && (
            <button
              type="button"
              onClick={() => fetch_page(page + 1, applied_ref.current, false)}
              className="dcs-dt-tool cursor-pointer"
              style={{ height: 40, paddingLeft: "1.2rem", paddingRight: "1.2rem" }}
            >
              {translate("DCS_GALLERY_LOAD_MORE")}
            </button>
          )}
          {!loading && !has_more && items.length > 0 && (
            <span className="text-xs" style={{ color: "#9E9E9E", fontFamily: FONT }}>
              {translate("DCS_GALLERY_END")}
            </span>
          )}
        </div>
      </div>

      {open_item && (
        <DcsFileViewerModal
          fileUrl={open_item.url}
          fileName={open_item.name || open_item.field_label || ""}
          fileType={open_item.type || ""}
          onClose={() => setOpenItem(null)}
          actions={
            open_item.submission_id ? (
              <span className="inline-block" style={{ minWidth: 180 }}>
                <DcsButtonOutline onClick={() => open_in_table(open_item)}>{translate("DCS_GALLERY_OPEN_IN_TABLE")}</DcsButtonOutline>
              </span>
            ) : null
          }
        />
      )}
    </DcsWorkspaceShell>
  );
}
