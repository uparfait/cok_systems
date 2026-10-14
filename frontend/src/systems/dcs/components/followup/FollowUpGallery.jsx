import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { get_follow_up_media } from "../../services/followUpService.js";
import DcsPeriodFilter from "../DcsPeriodFilter.jsx";
import MediaGrid from "../gallery/MediaGrid.jsx";
import { useMediaGallery } from "../gallery/useMediaGallery.js";

const FONT = "'Montserrat', sans-serif";

export default function FollowUpGallery({ projectId, formGroupId }) {
  const { translate } = useDcsLanguage();
  const navigate = useNavigate();
  const fetcher = useCallback((page, limit, params) => get_follow_up_media(formGroupId, page, limit, params), [formGroupId]);
  const gallery = useMediaGallery(fetcher, formGroupId);

  const open_in_table = (item) => navigate(`/dcs-system/project/${projectId}/forms/${formGroupId}/follow-up?tab=table&record=${item.submission_id}`);

  return (
    <div className="dcs-ws-center">
      <div className="flex flex-wrap items-center gap-2 mb-3 px-1 sm:px-2">
        <DcsPeriodFilter period={gallery.period} onPeriodChange={gallery.setPeriod} from={gallery.from} onFromChange={gallery.setFrom} to={gallery.to} onToChange={gallery.setTo} onApply={gallery.handle_apply} includeAll />
        <span className="text-xs font-semibold flex-shrink-0" style={{ color: "#056daa", fontFamily: FONT }}>
          {translate("DCS_GALLERY_COUNT", { count: gallery.total })}
        </span>
      </div>
      <MediaGrid gallery={gallery} onOpenInTable={open_in_table} />
    </div>
  );
}
