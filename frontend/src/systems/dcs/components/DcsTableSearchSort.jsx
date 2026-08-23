import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { FILTER_CONTROL_HEIGHT_PX } from "./DcsPeriodFilter.jsx";

/**
 * Free-text search (matched against every field value within the
 * currently selected date range) plus a newest/oldest sort - shared by
 * both submissions tables, alongside their own DcsPeriodFilter. The whole
 * filter bar stays one non-wrapping row at every screen size (its parent
 * scrolls horizontally instead), so the search field grows/shrinks with a
 * floor (flex:1 with a minWidth) rather than ever going full-width and
 * pushing the sort button out of view. Sort is a single compact icon
 * toggle (an arrow that flips direction) rather than a dropdown, since
 * "Newest"/"Oldest" as text never fit a narrow control.
 */
export default function DcsTableSearchSort({ search, onSearchChange, onSearchSubmit, sort, onSortChange }) {
  const { translate } = useDcsLanguage();
  const is_oldest = sort === "oldest";

  return (
    <>
      <div className="relative flex-1" style={{ minWidth: 130 }}>
        <input
          type="text"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSearchSubmit();
          }}
          placeholder={translate("DCS_TABLE_SEARCH_PLACEHOLDER")}
          className="cok-auth-input text-sm w-full"
          style={{ fontFamily: "'Montserrat', sans-serif", paddingLeft: 12, paddingRight: 34, height: FILTER_CONTROL_HEIGHT_PX, minHeight: FILTER_CONTROL_HEIGHT_PX }}
        />
        <button
          type="button"
          onClick={onSearchSubmit}
          title={translate("DCS_TABLE_SEARCH_PLACEHOLDER")}
          className="dcs-sort-toggle absolute cursor-pointer flex items-center justify-center"
          style={{ right: 3, top: "50%", transform: "translateY(-50%)", width: 26, height: 26, borderRadius: "50%", border: "none", backgroundColor: "transparent" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#056daa" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </div>
      <button
        type="button"
        onClick={() => onSortChange(is_oldest ? "newest" : "oldest")}
        title={translate(is_oldest ? "DCS_TABLE_SORT_OLDEST" : "DCS_TABLE_SORT_NEWEST")}
        className="dcs-sort-toggle cursor-pointer flex items-center justify-center bg-white border flex-shrink-0"
        style={{ width: FILTER_CONTROL_HEIGHT_PX, height: FILTER_CONTROL_HEIGHT_PX, borderColor: "#E0E0E0" }}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#056daa"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="dcs-sort-icon"
          style={{ transform: is_oldest ? "rotate(180deg)" : "none" }}
        >
          <line x1="12" y1="4" x2="12" y2="20" />
          <polyline points="6 10 12 4 18 10" />
        </svg>
      </button>
    </>
  );
}
