import React, { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { create_follow_up } from "../services/followUpService.js";
import { useFollowUp } from "../components/followup/useFollowUp.js";
import DcsFormNav from "../components/DcsFormNav.jsx";
import { ExpandFab, useExpandable } from "../components/DcsWorkspaceShell.jsx";
import DcsLoadingState from "../components/DcsLoadingState.jsx";
import DcsEmptyState from "../components/DcsEmptyState.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import FollowUpTable from "../components/followup/FollowUpTable.jsx";
import FollowUpGallery from "../components/followup/FollowUpGallery.jsx";
import FollowUpSettings from "../components/followup/FollowUpSettings.jsx";

const FONT = "'Montserrat', sans-serif";
const BORDER = "#E0E0E0";
const TABS = [
  { key: "table", labelKey: "DCS_FU_TAB_TABLE" },
  { key: "gallery", labelKey: "DCS_FU_TAB_GALLERY" },
  { key: "settings", labelKey: "DCS_FU_TAB_SETTINGS" },
];

function CreateCard({ creating, canEdit, onCreate, translate }) {
  return (
    <div className="max-w-xl mx-auto bg-white border-2 p-4 sm:p-6 space-y-4" style={{ borderColor: BORDER }}>
      <p className="text-sm font-bold uppercase" style={{ color: "#333333", letterSpacing: "0.4px", fontFamily: FONT }}>
        {translate("DCS_FU_NONE_TITLE")}
      </p>
      <p className="text-sm" style={{ color: "#555555", fontFamily: FONT, lineHeight: 1.6 }}>
        {translate("DCS_FU_NONE_INTRO")}
      </p>
      {canEdit ? (
        <div className="w-full sm:w-64">
          <DcsButtonPrimary onClick={onCreate} disabled={creating}>
            {creating ? translate("DCS_WAITING_GENERIC") : translate("DCS_FU_CREATE_BTN")}
          </DcsButtonPrimary>
        </div>
      ) : (
        <p className="text-xs" style={{ color: "#9E9E9E", fontFamily: FONT }}>
          {translate("DCS_FU_READ_ONLY")}
        </p>
      )}
    </div>
  );
}

export default function FollowUpPage() {
  const { project_id, form_group_id } = useParams();
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const [search_params, setSearchParams] = useSearchParams();
  const state = useFollowUp(form_group_id);
  const expand = useExpandable();
  const [creating, setCreating] = useState(false);

  const requested_tab = search_params.get("tab") || "";
  const tab = TABS.some((entry) => entry.key === requested_tab) ? requested_tab : "table";

  const set_tab = (key) => {
    const next = new URLSearchParams();
    next.set("tab", key);
    setSearchParams(next);
  };

  const handle_create = async () => {
    setCreating(true);
    try {
      const response = await create_follow_up(form_group_id);
      showSuccess(response.message || translate("DCS_FU_CREATED_TOAST"));
      await state.reload();
      set_tab("settings");
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setCreating(false);
    }
  };

  const tabs = state.follow_up ? (
    <div className="flex items-end gap-0.5 border-b overflow-x-auto" style={{ borderColor: BORDER }} role="tablist">
      {TABS.map((entry) => (
        <button key={entry.key} type="button" role="tab" aria-selected={tab === entry.key} onClick={() => set_tab(entry.key)} className={`dcs-record-tab ${tab === entry.key ? "is-active" : ""}`}>
          {translate(entry.labelKey)}
        </button>
      ))}
    </div>
  ) : null;

  let content = null;
  if (state.loading) {
    content = <DcsLoadingState />;
  } else if (state.error) {
    content = <DcsEmptyState messageKey="DCS_FU_LOAD_FAILED" />;
  } else if (!state.follow_up) {
    content = (
      <div className="flex-1 min-h-0 overflow-y-auto px-1 sm:px-2">
        <CreateCard creating={creating} canEdit={state.can_edit} onCreate={handle_create} translate={translate} />
      </div>
    );
  } else if (tab === "table") {
    content = <FollowUpTable projectId={project_id} formGroupId={form_group_id} versions={state.versions} canEdit={state.can_edit} onChanged={state.reload} />;
  } else if (tab === "gallery") {
    content = (
      <div className="flex-1 min-h-0 overflow-y-auto">
        <FollowUpGallery projectId={project_id} formGroupId={form_group_id} />
      </div>
    );
  } else {
    content = (
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="dcs-ws-center">
          <FollowUpSettings formGroupId={form_group_id} followUp={state.follow_up} versions={state.versions} canEdit={state.can_edit} recordCount={state.record_count} onChanged={state.reload} />
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col pb-4 ${expand.expanded ? "dcs-dt-expanded" : ""}`}>
      <DcsFormNav projectId={project_id} formGroupId={form_group_id} />

      <div className="dcs-ws-center flex-shrink-0 mb-3 px-1 sm:px-2 flex flex-wrap items-center gap-2">
        <p className="text-sm font-bold uppercase min-w-0 truncate" style={{ color: "#333333", fontFamily: FONT, letterSpacing: "0.4px" }}>
          {translate("DCS_FORM_NAV_FOLLOW_UP")}
        </p>
        {tabs}
      </div>

      {content}

      <ExpandFab expanded={expand.expanded} onToggle={expand.toggle} />
    </div>
  );
}
