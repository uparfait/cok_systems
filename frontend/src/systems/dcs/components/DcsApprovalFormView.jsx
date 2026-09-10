import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import RendererEngine from "../renderer/RendererEngine.jsx";
import DcsPagerButton from "./DcsPagerButton.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

const FORM_BORDER = "rgba(5,109,170,0.35)";
const GRAY = "#9E9E9E";
const NEUTRAL_DARK = "#333333";
const NEUTRAL_LIGHT = "#F7F9FB";
const fontHeading = "'Montserrat', sans-serif";

export default function DcsApprovalFormView({
  record,
  form,
  index,
  total,
  loadingMore,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
  decisionSlot,
}) {
  const { translate } = useDcsLanguage();
  const schema = (form && form.schema) || { fields: [] };

  return (
    <div
      key="form"
      className="dcs-view-swap mt-3 flex flex-col overflow-hidden max-h-[75vh] lg:max-h-none lg:flex-1 lg:min-h-0"
      style={{ backgroundColor: NEUTRAL_LIGHT }}
    >
      <div className="flex-1 min-h-0 overflow-y-auto px-0 min-[760px]:px-4 py-0 min-[760px]:py-4">
        <div
          className="w-full min-[760px]:max-w-[700px] mx-auto bg-white p-4 border-0 min-[760px]:border-[5px] min-[760px]:rounded-[5px] mt-0 min-[760px]:mt-3 mb-0 min-[760px]:mb-6"
          style={{ borderColor: FORM_BORDER }}
        >
          <div className="dcs-readonly-form" aria-disabled="true">
            <RendererEngine
              schema={schema}
              mode="renderer"
              values={record.data || {}}
              onValueChange={() => {}}
              fieldErrors={{}}
              fieldValidMessages={{}}
              revealAllErrors={false}
            />
          </div>

          <div className="mt-5 pt-4 flex items-center justify-between gap-3 flex-wrap" style={{ borderTop: `1px solid #E0E0E0` }}>
            <p className="text-xs" style={{ color: GRAY, fontFamily: fontHeading }}>
              {record.submitted_at ? new Date(record.submitted_at).toLocaleString() : ""}
            </p>
            {decisionSlot}
          </div>
        </div>
      </div>

      <div
        className="shrink-0 flex items-center justify-center gap-4 px-3 py-3 bg-white"
        style={{ borderTop: `1px solid #E0E0E0` }}
      >
        <DcsPagerButton
          direction="previous"
          title={translate("DCS_MYAPPROVALS_PREVIOUS")}
          onClick={onPrevious}
          disabled={!canGoPrevious}
        />
        <span className="text-sm font-bold whitespace-nowrap" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
          {translate("DCS_MYAPPROVALS_RECORD_OF", { index, total })}
        </span>
        <DcsPagerButton
          direction="next"
          title={translate("DCS_MYAPPROVALS_NEXT")}
          onClick={onNext}
          disabled={!canGoNext}
        />
        {loadingMore && <SpiralLoader padded={false} size={18} />}
      </div>
    </div>
  );
}
