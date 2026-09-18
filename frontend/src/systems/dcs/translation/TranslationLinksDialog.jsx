import React, { useEffect, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { list_translation_links, create_translation_link, delete_translation_link, translation_link_url } from "../services/formsService.js";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsConfirmDialog from "../components/DcsConfirmDialog.jsx";
import TranslationReviewDialog from "./TranslationReviewDialog.jsx";
import { LANGUAGES, LANGUAGE_NAME_KEYS } from "./translationTexts.js";

const FONT = { fontFamily: "'Montserrat', sans-serif" };
const BORDER = "#E0E0E0";
const MUTED = "#9E9E9E";
const PRIMARY = "#056daa";
const AMBER = "#B9770E";

const format_date = (value, language) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(language === "fr" ? "fr-FR" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
};

/**
 * The translation links of one form, for its editors: create a link (named,
 * with the LANGUAGES its holder may not change ticked), copy a link, review
 * what its translator proposed (apply, restore, dismiss), delete a link.
 * A link opens the public translation page without sign-in; what is saved
 * there never touches the form until it is applied here.
 */
export default function TranslationLinksDialog({ formGroupId, form, onClose }) {
  const { translate, language } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [locked, setLocked] = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [reviewing, setReviewing] = useState(null);

  const reload = () =>
    list_translation_links(formGroupId)
      .then((response) => setLinks((response.data && response.data.links) || []))
      .catch((error) => showError(error.message || translate("DCS_ERROR_GENERIC")))
      .finally(() => setLoading(false));

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formGroupId]);

  const toggle_locked = (code) => setLocked((current) => (current.includes(code) ? current.filter((entry) => entry !== code) : current.concat(code)));

  const create = async () => {
    if (locked.length === LANGUAGES.length) {
      showError(translate("DCS_TRANSLATION_ALL_LOCKED"));
      return;
    }
    setSaving(true);
    try {
      const response = await create_translation_link(formGroupId, { title, locked_languages: locked });
      showSuccess(response.message || translate("DCS_TRANSLATION_LINK_CREATED"));
      setTitle("");
      setLocked([]);
      await reload();
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setSaving(false);
    }
  };

  const copy = (link) => {
    window.navigator.clipboard.writeText(translation_link_url(link.token));
    showSuccess(translate("DCS_TOAST_LINK_COPIED"));
  };

  const remove = async () => {
    const link = deleting;
    setDeleting(null);
    try {
      const response = await delete_translation_link(formGroupId, link.id);
      showSuccess(response.message || translate("DCS_TRANSLATION_LINK_DELETED"));
      await reload();
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white border-2 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-5" style={{ borderColor: BORDER }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold" style={{ color: "#333333", ...FONT }}>
              {translate("DCS_TRANSLATION_LINKS_TITLE")}
            </h2>
            <p className="text-xs mt-1" style={{ color: MUTED, ...FONT }}>
              {translate("DCS_TRANSLATION_LINKS_HINT")}
            </p>
          </div>
          <DcsButtonOutline onClick={onClose}>{translate("DCS_BTN_CLOSE")}</DcsButtonOutline>
        </div>

        <div className="border p-4 space-y-3" style={{ borderColor: BORDER }}>
          <div>
            <label className="cok-auth-label">{translate("DCS_TRANSLATION_LINK_NAME")}</label>
            <input className="cok-auth-input w-full py-2" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={translate("DCS_TRANSLATION_LINK_NAME")} />
          </div>
          <div>
            <label className="cok-auth-label">{translate("DCS_TRANSLATION_LOCKED_LANGUAGES")}</label>
            <p className="text-xs mb-2" style={{ color: MUTED, ...FONT }}>
              {translate("DCS_TRANSLATION_LOCKED_LANGUAGES_HINT")}
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {LANGUAGES.map((code) => (
                <label key={code} className="flex items-center gap-2 text-sm cursor-pointer" style={FONT}>
                  <input type="checkbox" checked={locked.includes(code)} onChange={() => toggle_locked(code)} style={{ accentColor: PRIMARY }} />
                  {translate(LANGUAGE_NAME_KEYS[code])}
                </label>
              ))}
            </div>
          </div>
          <DcsButtonPrimary onClick={create} disabled={saving}>
            {saving ? translate("DCS_WAITING_GENERIC") : translate("DCS_TRANSLATION_CREATE")}
          </DcsButtonPrimary>
        </div>

        <div className="space-y-2">
          {loading && (
            <p className="text-sm" style={{ color: MUTED, ...FONT }}>
              {translate("DCS_WAITING_GENERIC")}
            </p>
          )}
          {!loading && links.length === 0 && (
            <p className="text-sm" style={{ color: MUTED, ...FONT }}>
              {translate("DCS_TRANSLATION_NO_LINKS")}
            </p>
          )}
          {links.map((link) => (
            <div key={link.id} className="border p-3 space-y-2" style={{ borderColor: BORDER }}>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "#333333", ...FONT }}>
                  {link.title}
                </p>
                <p className="text-xs" style={{ color: MUTED, ...FONT }}>
                  {link.created_by_name} - {format_date(link.created_at, language)} - {translate("DCS_TRANSLATION_PENDING_SHORT", { count: link.pending || 0 })}, {translate("DCS_TRANSLATION_APPLIED_SHORT", { count: link.applied || 0 })}
                </p>
                {(link.locked_languages || []).length > 0 && (
                  <p className="text-xs" style={{ color: AMBER, ...FONT }}>
                    {translate("DCS_TRANSLATION_LOCKED_LANGUAGES")}: {link.locked_languages.map((code) => translate(LANGUAGE_NAME_KEYS[code] || "DCS_TRANSLATION_LANG_EN")).join(", ")}
                  </p>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <DcsButtonPrimary onClick={() => setReviewing(link)}>{translate("DCS_TRANSLATION_REVIEW_BTN", { count: link.pending || 0 })}</DcsButtonPrimary>
                <DcsButtonOutline onClick={() => copy(link)}>{translate("DCS_TRANSLATION_COPY")}</DcsButtonOutline>
                <DcsButtonOutline variant="danger" onClick={() => setDeleting(link)}>
                  {translate("DCS_TRANSLATION_DELETE")}
                </DcsButtonOutline>
              </div>
            </div>
          ))}
        </div>
      </div>
      {deleting && <DcsConfirmDialog titleKey="DCS_TRANSLATION_DELETE_TITLE" messageKey="DCS_TRANSLATION_DELETE_MESSAGE" onConfirm={remove} onCancel={() => setDeleting(null)} />}
      {reviewing && <TranslationReviewDialog formGroupId={formGroupId} link={reviewing} fields={(form && form.schema && form.schema.fields) || []} onClose={() => setReviewing(null)} onChanged={reload} />}
    </div>
  );
}
