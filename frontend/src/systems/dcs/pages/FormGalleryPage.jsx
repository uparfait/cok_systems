import React, { useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { get_submission_media } from "../services/submissionsService.js";
import DcsWorkspaceShell from "../components/DcsWorkspaceShell.jsx";
import DcsPeriodFilter from "../components/DcsPeriodFilter.jsx";
import MediaGrid from "../components/gallery/MediaGrid.jsx";
import { useMediaGallery } from "../components/gallery/useMediaGallery.js";

const FONT = "'Montserrat', sans-serif";

/**
 * Every picture and video the form AND its follow-up form collected,
 * newest first (scope=all). A screenful arrives at a time and the next
 * one is asked for by the button at the foot of the grid. A follow-up
 * tile carries a small tag, and opening a tile leads to the right table:
 * the form's data or the follow-up table.
 */
export default function FormGalleryPage() {
  const { project_id, form_group_id } = useParams();
  const { translate } = useDcsLanguage();
  const navigate = useNavigate();

  const fetcher = useCallback(
    (page, limit, params) => get_submission_media(form_group_id, page, limit, Object.assign({ scope: "all" }, params)),
    [form_group_id],
  );
  const gallery = useMediaGallery(fetcher, form_group_id);

  const open_in_table = (item) => {
    const base = `/dcs-system/project/${project_id}/forms/${form_group_id}`;
    if (item.source === "follow_up") navigate(`${base}/follow-up?tab=table&record=${item.submission_id}`);
    else navigate(`${base}/data?record=${item.submission_id}`);
  };

  return (
    <DcsWorkspaceShell
      projectId={project_id}
      formGroupId={form_group_id}
      titleKey="DCS_WS_GALLERY"
      toolbar={
        <>
          <DcsPeriodFilter period={gallery.period} onPeriodChange={gallery.setPeriod} from={gallery.from} onFromChange={gallery.setFrom} to={gallery.to} onToChange={gallery.setTo} onApply={gallery.handle_apply} includeAll />
          <span className="text-xs font-semibold flex-shrink-0" style={{ color: "#056daa", fontFamily: FONT }}>
            {translate("DCS_GALLERY_COUNT", { count: gallery.total })}
          </span>
        </>
      }
    >
      <MediaGrid gallery={gallery} onOpenInTable={open_in_table} tagOf={(item) => (item.source === "follow_up" ? translate("DCS_FU_TAG") : "")} />
    </DcsWorkspaceShell>
  );
}
