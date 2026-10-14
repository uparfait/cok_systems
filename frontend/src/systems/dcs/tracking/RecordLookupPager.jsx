import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { PageArrowButton } from "../components/DcsDataTable.jsx";

const MUTED = "#9E9E9E";
const FONT = "'Montserrat', sans-serif";

export default function RecordLookupPager({ page, pages, total, onPageChange, disabled }) {
  const { translate } = useDcsLanguage();
  const total_pages = Math.max(1, pages || 1);
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <span className="text-xs font-semibold" style={{ color: MUTED, fontFamily: FONT }}>
        {translate("DCS_TRACKING_RESULTS_COUNT", { count: total })}
      </span>
      {total_pages > 1 && (
        <span className="flex items-center gap-2">
          <PageArrowButton direction="prev" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)} />
          <span className="text-xs font-bold uppercase text-center" style={{ color: MUTED, fontFamily: FONT, letterSpacing: 0.5, minWidth: 90 }}>
            {translate("DCS_TRACKING_PAGE_OF", { page, pages: total_pages })}
          </span>
          <PageArrowButton direction="next" disabled={disabled || page >= total_pages} onClick={() => onPageChange(page + 1)} />
        </span>
      )}
    </div>
  );
}
