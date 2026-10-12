import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "@/core/contexts/ToastContext";
import DcsWorkspaceShell from "../components/DcsWorkspaceShell.jsx";
import DcsExportDialog from "../components/DcsExportDialog.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsImportWizard from "../components/import/DcsImportWizard.jsx";
import { download_import_template } from "../services/importService.js";

const FONT = { fontFamily: "'Montserrat', sans-serif" };
const BORDER = "#E0E0E0";
const TABS = [
  { key: "download", labelKey: "DCS_DL_TAB_DOWNLOAD" },
  { key: "imports", labelKey: "DCS_DL_TAB_IMPORTS" },
];

function Card({ title, hint, children }) {
  return (
    <div className="bg-white border-2 p-4 sm:p-5" style={{ borderColor: BORDER }}>
      <p className="text-sm font-bold uppercase mb-1" style={{ color: "#333333", letterSpacing: "0.4px", ...FONT }}>
        {title}
      </p>
      {hint ? (
        <p className="text-xs mb-3" style={{ color: "#9E9E9E", ...FONT }}>
          {hint}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export default function FormDownloadsPage() {
  const { project_id, form_group_id } = useParams();
  const { translate, language } = useDcsLanguage();
  const { showError } = useToast();
  const [tab, setTab] = useState("download");
  const [import_open, setImportOpen] = useState(false);
  const [template_format, setTemplateFormat] = useState("csv");
  const [template_busy, setTemplateBusy] = useState(false);

  const download_template = async () => {
    if (template_busy) return;
    setTemplateBusy(true);
    try {
      await download_import_template(form_group_id, language, template_format);
    } catch (error) {
      showError(error.message || translate("DCS_DL_TEMPLATE_FAILED"));
    } finally {
      setTemplateBusy(false);
    }
  };

  const tabs = (
    <div className="flex items-end gap-0.5 border-b" style={{ borderColor: BORDER }} role="tablist">
      {TABS.map((entry) => (
        <button key={entry.key} type="button" role="tab" aria-selected={tab === entry.key} onClick={() => setTab(entry.key)} className={`dcs-record-tab ${tab === entry.key ? "is-active" : ""}`}>
          {translate(entry.labelKey)}
        </button>
      ))}
    </div>
  );

  return (
    <DcsWorkspaceShell projectId={project_id} formGroupId={form_group_id} title="" toolbar={tabs}>
      <div className="px-1 sm:px-2 max-w-xl mx-auto space-y-4">
        {tab === "download" && (
          <>
            <DcsExportDialog asPage form_group_id={form_group_id} />
            <Card title={translate("DCS_DL_TEMPLATE_TITLE")}>
              <label className="cok-auth-label">{translate("DCS_DL_TEMPLATE_FORMAT")}</label>
              <select value={template_format} onChange={(event) => setTemplateFormat(event.target.value)} disabled={template_busy} className="cok-auth-input w-full cursor-pointer mb-3" style={{ paddingLeft: 14, ...FONT }}>
                <option value="csv">{translate("DCS_DL_FORMAT_CSV")}</option>
                <option value="xlsx">{translate("DCS_DL_FORMAT_XLSX")}</option>
              </select>
              <DcsButtonOutline onClick={download_template} disabled={template_busy}>
                {template_busy ? translate("DCS_WAITING_GENERIC") : translate("DCS_DL_TEMPLATE_BTN")}
              </DcsButtonOutline>
            </Card>
          </>
        )}
        {tab === "imports" && (
          <Card title={translate("DCS_IMPORT_TITLE")} hint={translate("DCS_IMPORT_SUBTITLE")}>
            <DcsButtonPrimary onClick={() => setImportOpen(true)}>{translate("DCS_DL_ACTION_IMPORT")}</DcsButtonPrimary>
          </Card>
        )}
      </div>
      {import_open && <DcsImportWizard formGroupId={form_group_id} onClose={() => setImportOpen(false)} />}
    </DcsWorkspaceShell>
  );
}
