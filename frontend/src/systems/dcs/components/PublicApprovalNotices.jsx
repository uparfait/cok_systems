import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

const FONT = "'Montserrat', sans-serif";

/**
 * The panel over the public form listing every approver who was just
 * emailed a link after a submission (or a record update) - shown only
 * while at least one email actually went out.
 */
export default function PublicApprovalNotices({ notices, onClose }) {
  const { translate } = useDcsLanguage();
  if (!notices.some((notice) => notice.links.some((link_info) => link_info.email_sent))) return null;
  return (
    <div className="dcs-no-print w-full min-[760px]:max-w-[700px] bg-white border-2 p-4 mb-3" style={{ borderColor: "#056daa" }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold" style={{ color: "#056daa", fontFamily: FONT }}>
          {translate("DCS_APPROVAL_LINK_PANEL_TITLE")}
        </p>
        <button type="button" onClick={onClose} className="cursor-pointer text-xs font-semibold" style={{ color: "#9E9E9E", fontFamily: FONT, background: "none", border: "none" }}>
          {translate("DCS_BTN_CLOSE")}
        </button>
      </div>
      {notices.map((notice, notice_index) =>
        notice.links
          .filter((link_info) => link_info.email_sent)
          .map((link_info, link_index) => (
            <p key={`${notice_index}_${link_index}`} className="mt-3 text-sm px-3 py-2" style={{ backgroundColor: "rgba(76,175,80,0.12)", color: "#4CAF50", fontFamily: FONT }}>
              {translate("DCS_APPROVAL_LINK_EMAILED", { name: link_info.name, role: link_info.role })}
            </p>
          )),
      )}
    </div>
  );
}
