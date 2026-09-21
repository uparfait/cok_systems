import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { DcsLanguageProvider, useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { get_public_translation, identify_translator, save_public_translation } from "../services/formsService.js";
import { request_error_text } from "../util-dashboard/dashboardService.js";
import { read_respondent } from "../offline/respondentStore.js";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsLoadingState from "../components/DcsLoadingState.jsx";
import DcsRespondentGate from "../components/DcsRespondentGate.jsx";
import TranslationFieldCard from "../translation/TranslationFieldCard.jsx";
import { translatable_entries, set_change, count_changes, index_proposals, owners_by_field, page_count, page_slice, LANGUAGES, LANGUAGE_NAME_KEYS } from "../translation/translationTexts.js";

const FONT = { fontFamily: "'Montserrat', sans-serif" };
const MUTED = "#9E9E9E";
const TEXT = "#333333";
const PRIMARY = "#056daa";
const PAGE_BG = "#F7F9FB";
const first_name = (name) => String(name || "").trim().split(" ")[0];

/**
 * A form opened through a translation link: no sign-in, but every
 * translator first says who they are. A known email comes back to their
 * own saved texts and the page they stopped on; a new one is created. The
 * fields that carry a text a respondent sees are shown three at a time,
 * each drawn as the respondent sees it, with English, Kinyarwanda and
 * French stacked under every text. A field one translator has worked on is
 * theirs alone - others see it, with their name, but cannot change it.
 * Saving stores PROPOSALS: the form changes only when its owner applies them.
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
  const [translator, setTranslator] = useState(null);
  // The texts arrive only with an identified translator - never before.
  const [work, setWork] = useState({ fields: [], proposals: [] });
  const [gate_open, setGateOpen] = useState(true);
  const [saved_identity] = useState(() => read_respondent());
  const page_timer_ref = useRef(null);

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

  const entries = useMemo(() => (translator ? translatable_entries(work.fields, translate, language) : []), [translator, work.fields, translate, language]);
  const proposals = useMemo(() => index_proposals(work.proposals), [work.proposals]);
  const owners = useMemo(() => owners_by_field(work.proposals), [work.proposals]);
  const pages = page_count(entries.length);
  const shown = page_slice(entries, page);
  const pending = count_changes(changes);
  const locked = (info && info.locked_languages) || [];

  // The page a translator is on is remembered on the server, so the next
  // visit opens where they stopped.
  useEffect(() => {
    if (!translator) return;
    window.clearTimeout(page_timer_ref.current);
    page_timer_ref.current = window.setTimeout(() => identify_translator(token, translator, page).catch(() => {}), 800);
    return () => window.clearTimeout(page_timer_ref.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, translator]);

  const handle_identify = async (identity) => {
    try {
      const response = await identify_translator(token, identity);
      const data = response.data || {};
      const fields = data.fields || [];
      setTranslator(data.translator || identity);
      setWork({ fields, proposals: data.proposals || [] });
      const total = page_count(translatable_entries(fields, translate, language).length);
      const resume = Math.min(total - 1, Math.max(0, (data.translator && data.translator.last_page) || 0));
      setPage(resume);
      setChanges({});
      setGateOpen(false);
      if (data.translator && data.translator.created_at && resume > 0) {
        showSuccess(translate("DCS_TRANSLATION_RESUMED", { name: first_name(identity.name), page: resume + 1 }));
      }
    } catch (error) {
      showError(request_error_text(error, translate("DCS_ERROR_GENERIC")));
    }
  };

  const go = (next) => {
    setPage(Math.min(pages - 1, Math.max(0, next)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async () => {
    if (pending === 0 || !translator) return;
    setSaving(true);
    try {
      const response = await save_public_translation(token, changes, translator, page);
      showSuccess(response.message || translate("DCS_TRANSLATION_SAVED"));
      setChanges({});
      setWork((current) => Object.assign({}, current, { proposals: (response.data && response.data.proposals) || current.proposals }));
    } catch (error) {
      showError(request_error_text(error, translate("DCS_ERROR_GENERIC")));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !info) return <DcsLoadingState />;

  if (failure) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: PAGE_BG }}>
        <p className="text-sm text-center" style={{ color: "#E74C3C", ...FONT }}>
          {failure}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-36" style={{ backgroundColor: PAGE_BG }}>
      <Helmet>
        <title>{`${info.form_name} - ${translate("DCS_TRANSLATION_PAGE_TITLE")}`}</title>
      </Helmet>

      {gate_open && <DcsRespondentGate saved={translator || saved_identity} onConfirm={handle_identify} titleKey="DCS_TRANSLATION_WHO_TITLE" messageKey="DCS_TRANSLATION_WHO_MESSAGE" />}

      <div className="max-w-3xl mx-auto px-3 sm:px-4 pt-3 sm:pt-6 space-y-3">
        <div className="bg-white cok-auth-card p-4 sm:p-5 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase" style={{ color: MUTED, letterSpacing: "0.5px", ...FONT }}>
                {translate("DCS_TRANSLATION_PAGE_TITLE")}
              </p>
              <h1 className="text-base sm:text-lg font-bold truncate" style={{ color: TEXT, ...FONT }}>
                {info.form_name}
              </h1>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              {LANGUAGES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLanguage(code)}
                  className="text-xs font-bold uppercase cursor-pointer bg-transparent border-0 p-0"
                  style={{ color: language === code ? PRIMARY : MUTED, borderBottom: language === code ? `2px solid ${PRIMARY}` : "2px solid transparent", ...FONT }}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
          {translator && (
            <p className="text-xs flex items-center gap-2 flex-wrap" style={{ color: TEXT, ...FONT }}>
              {translate("DCS_TRANSLATION_AS", { name: first_name(translator.name) })}
              <button type="button" className="underline cursor-pointer bg-transparent border-0 p-0 text-xs" style={{ color: PRIMARY, ...FONT }} onClick={() => setGateOpen(true)}>
                {translate("DCS_RESPONDENT_CHANGE")}
              </button>
            </p>
          )}
          <p className="text-xs" style={{ color: MUTED, ...FONT }}>
            {translate("DCS_TRANSLATION_PAGE_HINT")}
          </p>
          {locked.length > 0 && (
            <p className="text-xs" style={{ color: MUTED, ...FONT }}>
              {translate("DCS_TRANSLATION_LOCKED_LANGUAGES")}: {locked.map((code) => translate(LANGUAGE_NAME_KEYS[code])).join(", ")}
            </p>
          )}
        </div>

        {shown.map((entry, index) => (
          <TranslationFieldCard
            key={entry.field.id}
            entry={entry}
            index={page * shown.length + index + 1}
            lockedLanguages={locked}
            changes={changes}
            proposals={proposals}
            owner={owners.get(entry.field.id) || null}
            onChange={(field_id, key, code, value) => setChanges((current) => set_change(current, field_id, key, code, value))}
          />
        ))}
        {!translator && (
          <p className="text-sm" style={{ color: MUTED, ...FONT }}>
            {translate("DCS_TRANSLATION_IDENTIFY_FIRST")}
          </p>
        )}
        {translator && entries.length === 0 && (
          <p className="text-sm" style={{ color: MUTED, ...FONT }}>
            {translate("DCS_TRANSLATION_NO_TEXTS")}
          </p>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-white px-3 sm:px-4 py-3" style={{ boxShadow: "0 -4px 16px rgba(0,0,0,0.06)", paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
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
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs min-w-0" style={{ color: pending > 0 ? PRIMARY : MUTED, ...FONT }}>
              {pending > 0 ? translate("DCS_TRANSLATION_CHANGES", { count: pending }) : translate("DCS_TRANSLATION_SAVED_NOTE")}
            </p>
            <DcsButtonPrimary onClick={save} disabled={pending === 0 || saving || !translator}>
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
