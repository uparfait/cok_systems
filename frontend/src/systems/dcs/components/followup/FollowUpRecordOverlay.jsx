import React from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import DcsRecordViewOverlay from "../DcsRecordViewOverlay.jsx";
import DcsButtonPrimary from "../DcsButtonPrimary.jsx";

export default function FollowUpRecordOverlay({ record, fields, onLoad, onClose }) {
  const { translate } = useDcsLanguage();
  return (
    <DcsRecordViewOverlay
      record={record}
      fields={fields}
      tracking={null}
      noApproval
      title={translate("DCS_FU_RECORD_TITLE")}
      onClose={onClose}
      footer={
        <>
          <span className="flex-1" />
          <DcsButtonPrimary onClick={() => onLoad(record)}>{translate("DCS_TRACKING_LOAD")}</DcsButtonPrimary>
        </>
      }
    />
  );
}
