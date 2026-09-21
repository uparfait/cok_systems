import React, { useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { validate_respondent, save_respondent } from "../offline/respondentStore.js";
import DcsCenterOverlay from "./DcsCenterOverlay.jsx";
import DcsButtonPrimary from "./DcsButtonPrimary.jsx";
import DcsButtonOutline from "./DcsButtonOutline.jsx";

const FONT = "'Montserrat', sans-serif";
const FIELDS = [
  { key: "name", labelKey: "DCS_RESPONDENT_NAME", type: "text", autoComplete: "name" },
  { key: "email", labelKey: "DCS_RESPONDENT_EMAIL", type: "email", autoComplete: "email" },
  { key: "phone", labelKey: "DCS_RESPONDENT_PHONE", type: "tel", autoComplete: "tel" },
];

export default function DcsRespondentGate({ saved, onConfirm, titleKey, messageKey }) {
  const { translate } = useDcsLanguage();
  const [mode, setMode] = useState(saved ? "confirm" : "edit");
  const [draft, setDraft] = useState(saved || { name: "", email: "", phone: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const run = async (action) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const handle_save = () => {
    const result = validate_respondent(draft, translate);
    setErrors(result.errors);
    if (!result.valid || busy) return;
    run(() => onConfirm(save_respondent(result.respondent)));
  };

  if (mode === "confirm" && saved) {
    return (
      <DcsCenterOverlay title={translate("DCS_RESPONDENT_CONFIRM_TITLE")} message={translate("DCS_RESPONDENT_CONFIRM_MESSAGE")}>
        <div className="border-2 p-3 mb-4" style={{ borderColor: "#E0E0E0" }}>
          <p className="text-sm font-bold" style={{ color: "#333333", fontFamily: FONT }}>{saved.name}</p>
          <p className="text-sm break-all" style={{ color: "#555555", fontFamily: FONT }}>{saved.email}</p>
          <p className="text-sm" style={{ color: "#555555", fontFamily: FONT }}>{saved.phone}</p>
        </div>
        <div className="flex flex-col min-[480px]:flex-row gap-2">
          <DcsButtonPrimary className="flex-1" onClick={() => run(() => onConfirm(saved))} disabled={busy}>
            {busy ? translate("DCS_WAITING_GENERIC") : translate("DCS_RESPONDENT_CONTINUE_AS", { name: String(saved.name || "").trim().split(" ")[0] })}
          </DcsButtonPrimary>
          <DcsButtonOutline className="flex-1" onClick={() => setMode("edit")} disabled={busy}>
            {translate("DCS_RESPONDENT_CHANGE")}
          </DcsButtonOutline>
        </div>
      </DcsCenterOverlay>
    );
  }

  return (
    <DcsCenterOverlay title={translate(titleKey || "DCS_RESPONDENT_TITLE")} message={translate(messageKey || "DCS_RESPONDENT_MESSAGE")}>
      <div className="flex flex-col gap-3">
        {FIELDS.map((field) => (
          <div key={field.key}>
            <label className="cok-auth-label" htmlFor={`dcs_respondent_${field.key}`}>
              {translate(field.labelKey)}
              <span style={{ color: "#E74C3C" }}> *</span>
            </label>
            <input
              id={`dcs_respondent_${field.key}`}
              type={field.type}
              autoComplete={field.autoComplete}
              className="cok-auth-input w-full py-3"
              style={{ paddingLeft: 14 }}
              value={draft[field.key] || ""}
              onChange={(event) => setDraft(Object.assign({}, draft, { [field.key]: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === "Enter") handle_save();
              }}
            />
            {errors[field.key] && (
              <p className="mt-1 text-xs" style={{ color: "#E74C3C", fontFamily: FONT }}>
                {errors[field.key]}
              </p>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-col min-[480px]:flex-row gap-2 mt-5">
        <DcsButtonPrimary className="flex-1" onClick={handle_save} disabled={busy}>
          {busy ? translate("DCS_WAITING_GENERIC") : translate("DCS_RESPONDENT_SAVE")}
        </DcsButtonPrimary>
        {saved && (
          <DcsButtonOutline className="flex-1" onClick={() => setMode("confirm")} disabled={busy}>
            {translate("DCS_BTN_CANCEL")}
          </DcsButtonOutline>
        )}
      </div>
      <p className="mt-3 text-xs" style={{ color: "#9E9E9E", fontFamily: FONT }}>
        {translate("DCS_RESPONDENT_STORED_NOTE")}
      </p>
    </DcsCenterOverlay>
  );
}
