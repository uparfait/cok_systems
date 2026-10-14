import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import DcsFileViewerModal from "../DcsFileViewerModal.jsx";
import DcsEmptyState from "../DcsEmptyState.jsx";
import DcsButtonOutline from "../DcsButtonOutline.jsx";
import { GallerySkeleton } from "../DcsSkeletons.jsx";

const FONT = "'Montserrat', sans-serif";
const VIDEO_PATTERN = /\.(mp4|webm|mov|m4v|mkv|ogv|avi)(\?|#|$)/i;

function is_video(item) {
  if (item.type && /^video\//i.test(item.type)) return true;
  return VIDEO_PATTERN.test(item.name || item.url || "");
}

function MediaTile({ item, tag, onOpen }) {
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

      {tag ? (
        <span className="absolute left-1 top-1 px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ fontFamily: FONT, color: "#FFFFFF", backgroundColor: "#056daa", letterSpacing: "0.4px" }}>
          {tag}
        </span>
      ) : null}

      <span
        className="absolute left-0 right-0 bottom-0 px-1.5 py-1 text-left truncate"
        style={{ fontFamily: FONT, fontSize: 10, color: "#FFFFFF", background: "linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0))" }}
      >
        {item.field_label || item.name || ""}
      </span>
    </button>
  );
}

export default function MediaGrid({ gallery, onOpenInTable, tagOf }) {
  const { translate } = useDcsLanguage();
  const [search_params, setSearchParams] = useSearchParams();
  const image_url = search_params.get("image") || "";
  const open_item = image_url
    ? gallery.items.find((item) => item.url === image_url) || { url: image_url, name: image_url.split("/").pop().split("?")[0], type: "" }
    : null;
  const setOpenItem = (item) => {
    const next = new URLSearchParams(search_params);
    if (item && item.url) next.set("image", item.url);
    else next.delete("image");
    setSearchParams(next, { replace: !item });
  };

  return (
    <div className="bg-white border-2 p-2 sm:p-3" style={{ borderColor: "#E0E0E0" }}>
      {gallery.is_first_load && <GallerySkeleton count={gallery.page_size} />}

      {!gallery.is_first_load && gallery.items.length === 0 && <DcsEmptyState messageKey="DCS_GALLERY_EMPTY" />}

      {gallery.items.length > 0 && (
        <div className="grid grid-cols-2 min-[480px]:grid-cols-3 min-[720px]:grid-cols-4 min-[1000px]:grid-cols-5 min-[1320px]:grid-cols-6 gap-2">
          {gallery.items.map((item) => (
            <MediaTile key={`${item.source || "form"}-${item.submission_id}-${item.field_id}-${item.url}`} item={item} tag={tagOf ? tagOf(item) : ""} onOpen={setOpenItem} />
          ))}
        </div>
      )}

      {gallery.loading && gallery.items.length > 0 && (
        <div className="mt-2">
          <GallerySkeleton count={Math.min(12, gallery.page_size)} />
        </div>
      )}

      <div className="flex items-center justify-center py-4">
        {!gallery.loading && gallery.has_more && (
          <button type="button" onClick={gallery.load_more} className="dcs-dt-tool cursor-pointer" style={{ height: 40, paddingLeft: "1.2rem", paddingRight: "1.2rem" }}>
            {translate("DCS_GALLERY_LOAD_MORE")}
          </button>
        )}
        {!gallery.loading && !gallery.has_more && gallery.items.length > 0 && (
          <span className="text-xs" style={{ color: "#9E9E9E", fontFamily: FONT }}>
            {translate("DCS_GALLERY_END")}
          </span>
        )}
      </div>

      {open_item && (
        <DcsFileViewerModal
          fileUrl={open_item.url}
          fileName={open_item.name || open_item.field_label || ""}
          fileType={open_item.type || ""}
          onClose={() => setOpenItem(null)}
          actions={
            open_item.submission_id && onOpenInTable ? (
              <span className="inline-block" style={{ minWidth: 180 }}>
                <DcsButtonOutline onClick={() => onOpenInTable(open_item)}>{translate("DCS_GALLERY_OPEN_IN_TABLE")}</DcsButtonOutline>
              </span>
            ) : null
          }
        />
      )}
    </div>
  );
}
