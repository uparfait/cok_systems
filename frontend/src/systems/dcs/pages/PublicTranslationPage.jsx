import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { DcsLanguageProvider, useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { get_public_translation, save_public_translation } from "../services/formsService.js";
import { request_error_text } from "../util-dashboard/dashboardService.js";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsLoadingState from "../components/DcsLoadingState.jsx";
import TranslationFieldCard from "../translation/TranslationFieldCard.jsx";
import { flatten_all_fields, set_change, count_changes, LANGUAGES } from "../translation/translationTexts.js";

const FONT = { fontFamily: "'Montserrat', sans-serif" };
const BORDER = "#E0E0E0";
const MUTED = "#9E9E9E";
const PRIMARY = "#056daa";

/**
 * A form opened through a translation link: no sign-in. Every field of the
 * form's active version is listed - conditions ignored, hidden fields
 * included - and every text it carries is shown in English, Kinyarwanda and
 * French, editable except for the kinds the link's creator locked. Save
 * writes the changed texts back into the form; nothing else about the form
 * can be changed here.
 */
function TranslationWorkbench() {
  const { token } = useParams();
  const { translate, language, setLanguage } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState("");
  const [changes, setChanges] = useState({});
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    return get_public_translation(token)
      .then((response) => {
        setInfo(response.data || null);
        setFailure("");
      })
      .catch((error) => setFailure(request_error_text(error, translate("DCS_ERROR_GENERIC"))))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const entries = useMemo(() => (info ? flatten_all_fields(info.fields) : []), [info]);
  const pending = count_changes(changes);
  const locked_kinds = (info && info.locked_kinds) || [];

  const handle_change = (field_id, path, code, value) => setChanges((current) => set_change(current, field_id, path, code, value));

  const save = async () => {
    if (pending === 0) return;
    setSaving(true);
    try {
      const response = await save_public_translation(token, changes);
      showSuccess(response.message || translate("DCS_TRANSLATION_SAVED"));
      setChanges({});
      await load();
    } catch (error) {
      showError(request_error_text(error, translate("DCS_ERROR_GENERIC")));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !info) return <DcsLoadingState />;

  if (failure) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: "#F5F7FA" }}>
        <div className="bg-white border-2 p-6 max-w-md text-center" style={{ borderColor: BORDER }}>
          <p className="text-sm" style={{ color: "#E74C3C", ...FONT }}>
            {failure}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: "#F5F7FA" }}>
      <Helmet>
        <title>{info ? `${info.form_name} - ${translate("DCS_TRANSLATION_PAGE_TITLE")}` : translate("DCS_TRANSLATION_PAGE_TITLE")}</title>
      </Helmet>
      <div className="max-w-4xl mx-auto px-4 pt-6 space-y-4">
        <div className="bg-white border-2 p-4 sm:p-6 flex items-start justify-between gap-3 flex-wrap" style={{ borderColor: BORDER }}>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase" style={{ color: MUTED, ...FONT }}>
              {translate("DCS_TRANSLATION_PAGE_TITLE")}
            </p>
            <h1 className="text-lg font-bold truncate" style={{ color: "#333333", ...FONT }}>
              {info.form_name}
            </h1>
            <p className="text-xs mt-1" style={{ color: MUTED, ...FONT }}>
              {translate("DCS_TRANSLATION_PAGE_HINT")}
            </p>
          </div>
          <div className="flex gap-1">
            {LANGUAGES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLanguage(code)}
                className="text-[11px] font-bold uppercase px-3 py-1 rounded-full cursor-pointer"
                style={{ border: `1px solid ${PRIMARY}`, color: language === code ? "#FFFFFF" : PRIMARY, backgroundColor: language === code ? PRIMARY : "transparent", ...FONT }}
              >
                {code}
              </button>
            ))}
          </div>
        </div>

        {entries.map((entry, index) => (
          <TranslationFieldCard key={entry.field.id || index} entry={entry} index={index + 1} lockedKinds={locked_kinds} changes={changes} onChange={handle_change} />
        ))}
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-white border-t-2 px-4 py-3" style={{ borderColor: BORDER }}>
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm" style={{ color: pending > 0 ? PRIMARY : MUTED, ...FONT }}>
            {pending > 0 ? translate("DCS_TRANSLATION_CHANGES", { count: pending }) : translate("DCS_TRANSLATION_NO_CHANGES")}
          </p>
          <div className="flex gap-2">
            <DcsButtonOutline onClick={() => setChanges({})} disabled={pending === 0 || saving}>
              {translate("DCS_BTN_CANCEL")}
            </DcsButtonOutline>
            <DcsButtonPrimary onClick={save} disabled={pending === 0 || saving}>
              {saving ? translate("DCS_WAITING_GENERIC") : translate("DCS_TRANSLATION_SAVE")}
            </DcsButtonPrimary>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PublicTranslationPage() {
  return (
    <DcsLanguageProvider>
      <TranslationWorkbench />
    </DcsLanguageProvider>
  );
}
