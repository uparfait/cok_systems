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
import { translatable_entries, set_change, count_changes, index_proposals, page_count, page_slice, LANGUAGES, LANGUAGE_NAME_KEYS } from "../translation/translationTexts.js";

const FONT = { fontFamily: "'Montserrat', sans-serif" };
const BORDER = "#E0E0E0";
const MUTED = "#9E9E9E";
const PRIMARY = "#056daa";
const AMBER = "#B9770E";

/**
 * A form opened through a translation link: no sign-in. The fields that
 * carry a text a respondent sees are shown three at a time, each drawn as
 * the respondent sees it, with English, Kinyarwanda and French stacked
 * under every text. Saving stores PROPOSALS - the form itself changes only
 * when its owner reviews and applies them, and the page shows how far each
 * saved text got.
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
  const [page, setPage] = useState(0);

  useEffect(() => {
    setLoading(true);
    get_public_translation(token)
      .then((response) => {
        setInfo(response.data || null);
        setFailure("");
      })
      .catch((error) => setFailure(request_error_text(error, translate("DCS_ERROR_GENERIC"))))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const entries = useMemo(() => (info ? translatable_entries(info.fields, translate, language) : []), [info, translate, language]);
  const proposals = useMemo(() => index_proposals(info ? info.proposals : []), [info]);
  const pages = page_count(entries.length);
  const shown = page_slice(entries, page);
  const pending = count_changes(changes);
  const locked = (info && info.locked_languages) || [];

  const go = (next) => {
    setPage(Math.min(pages - 1, Math.max(0, next)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async () => {
    if (pending === 0) return;
    setSaving(true);
    try {
      const response = await save_public_translation(token, changes);
      showSuccess(response.message || translate("DCS_TRANSLATION_SAVED"));
      setChanges({});
      setInfo((current) => Object.assign({}, current, { proposals: (response.data && response.data.proposals) || (current && current.proposals) || [] }));
    } catch (error) {
      showError(request_error_text(error, translate("DCS_ERROR_GENERIC")));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !info) return <DcsLoadingState />;

  if (failure) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#F5F7FA" }}>
        <div className="bg-white border-2 p-6 max-w-md text-center" style={{ borderColor: BORDER }}>
          <p className="text-sm" style={{ color: "#E74C3C", ...FONT }}>
            {failure}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32" style={{ backgroundColor: "#F5F7FA" }}>
      <Helmet>
        <title>{`${info.form_name} - ${translate("DCS_TRANSLATION_PAGE_TITLE")}`}</title>
      </Helmet>
      <div className="max-w-3xl mx-auto px-4 pt-4 sm:pt-6 space-y-4">
        <div className="bg-white border-2 p-4 sm:p-6 space-y-3" style={{ borderColor: BORDER }}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase" style={{ color: MUTED, ...FONT }}>
                {translate("DCS_TRANSLATION_PAGE_TITLE")}
              </p>
              <h1 className="text-lg font-bold" style={{ color: "#333333", ...FONT }}>
                {info.form_name}
              </h1>
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
          <p className="text-xs" style={{ color: MUTED, ...FONT }}>
            {translate("DCS_TRANSLATION_PAGE_HINT")}
          </p>
          {locked.length > 0 && (
            <p className="text-xs flex items-center gap-2 flex-wrap" style={{ color: AMBER, ...FONT }}>
              {translate("DCS_TRANSLATION_LOCKED_LANGUAGES")}:
              {locked.map((code) => (
                <span key={code} className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ border: `1px solid ${AMBER}` }}>
                  {translate(LANGUAGE_NAME_KEYS[code])}
                </span>
              ))}
            </p>
          )}
        </div>

        {shown.map((entry, index) => (
          <TranslationFieldCard key={entry.field.id} entry={entry} index={page * shown.length + index + 1} lockedLanguages={locked} changes={changes} proposals={proposals} onChange={(field_id, key, code, value) => setChanges((current) => set_change(current, field_id, key, code, value))} />
        ))}
        {entries.length === 0 && (
          <p className="text-sm" style={{ color: MUTED, ...FONT }}>
            {translate("DCS_TRANSLATION_NO_TEXTS")}
          </p>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-white border-t-2 px-4 py-3" style={{ borderColor: BORDER }}>
        <div className="max-w-3xl mx-auto space-y-2">
          <div className="flex items-center justify-between gap-2">
            <DcsButtonOutline onClick={() => go(page - 1)} disabled={page === 0 || saving}>
              {translate("DCS_TRANSLATION_BACK")}
            </DcsButtonOutline>
            <p className="text-xs text-center" style={{ color: MUTED, ...FONT }}>
              {translate("DCS_TRANSLATION_PAGE_OF", { page: page + 1, total: pages })}
            </p>
            <DcsButtonOutline onClick={() => go(page + 1)} disabled={page >= pages - 1 || saving}>
              {translate("DCS_TRANSLATION_NEXT")}
            </DcsButtonOutline>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs" style={{ color: pending > 0 ? PRIMARY : MUTED, ...FONT }}>
              {pending > 0 ? translate("DCS_TRANSLATION_CHANGES", { count: pending }) : translate("DCS_TRANSLATION_SAVED_NOTE")}
            </p>
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
