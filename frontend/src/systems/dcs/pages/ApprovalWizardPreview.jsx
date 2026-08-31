// TEMP DEV-ONLY PREVIEW - not linked from the app UI; used to style ApprovalFlowSection without login. Safe to delete.
import React, { useState } from "react";
import { DcsLanguageProvider } from "../i18n/LanguageContext.jsx";
import ApprovalFlowSection from "../builder/ApprovalFlowSection.jsx";

try { window.localStorage.setItem("dcs_language", "en"); } catch (ignored) { /* preview only */ }

const SAMPLE_FIELDS = [
  { id: "full_name", type: "text", label: { en: "Full name", kn: "Amazina", fr: "Nom complet" } },
  {
    id: "gender", type: "single_select", label: { en: "Gender", kn: "Igitsina", fr: "Genre" },
    options: [
      { id: "m", label: { en: "Male" }, value: "Male" },
      { id: "f", label: { en: "Female" }, value: "Female" },
    ],
  },
  {
    id: "select_group_prvnce", type: "select_group", label: { en: "Province", kn: "Intara", fr: "Province" },
    options: [
      { id: "Umujyi wa Kigali", label: { en: "Umujyi wa Kigali" }, value: "Umujyi wa Kigali" },
      { id: "Amajyepfo", label: { en: "Amajyepfo" }, value: "Amajyepfo" },
    ],
  },
];

const SAMPLE_CONFIG = {
  enabled: true,
  approvers: [
    {
      name: "Amos Ndayizeye", role: "Village leader", email: "amos@kigalicity.gov.rw",
      level: "VILLAGE", location_id: 11010101, location_name: "Gihanga",
      conditions: [], force: true, on_reject: "stop",
    },
    {
      name: "Claudine Uwase", role: "Sector executive", email: "claudine@kigalicity.gov.rw",
      level: "SECTOR", location_id: 1101, location_name: "Gitega",
      conditions: [{ field_id: "gender", value: "Female" }], force: false, on_reject: "continue",
    },
    {
      name: "", role: "", email: "",
      level: "", location_id: null, location_name: "",
      conditions: [], force: true, on_reject: "stop",
    },
  ],
};

export default function ApprovalWizardPreview() {
  const [config, setConfig] = useState(SAMPLE_CONFIG);
  return (
    <DcsLanguageProvider>
      <div className="min-h-screen py-8 px-4" style={{ backgroundColor: "#F7F9FB" }}>
        <div className="mx-auto" style={{ maxWidth: "800px" }}>
          <ApprovalFlowSection value={config} onChange={setConfig} fields={SAMPLE_FIELDS} />
        </div>
      </div>
    </DcsLanguageProvider>
  );
}
