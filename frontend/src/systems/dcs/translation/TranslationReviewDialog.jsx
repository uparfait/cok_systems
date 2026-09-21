import React, { useEffect, useMemo, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { list_translation_proposals, apply_translation_proposals, restore_translation_proposals, dismiss_translation_proposals } from "../services/formsService.js";
import { get_field_text } from "../fields/fieldText.js";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import { translatable_entries, field_type_name, LANGUAGE_NAME_KEYS, page_count, page_slice } from "./translationTexts.js";

const FONT = { fontFamily: "'Montserrat', sans-serif" };
const MUTED = "#9E9E9E";
const PRIMARY = "#056daa";
const TEXT = "#333333";
const AMBER = "#B9770E";
const GREEN = "#1f8a4c";
const FIELDS_PER_REVIEW_PAGE = 6;

const STATUS_KEY = { pending: "DCS_TRANSLATION_STATUS_PENDING", applied: "DCS_TRANSLATION_STATUS_APPLIED", restored: "DCS_TRANSLATION_STATUS_RESTORED" };
const STATUS_COLOR = { pending: AMBER, applied: GREEN, restored: MUTED };

/** What a proposal's path means, in the reviewer's words. */
function row_title(path, field, translate, language) {
  const [head, option_id] = path || [];
  if (head === "options") {
    const options = ((field && field.options) || []).concat(...(((field && field.parent_option_groups) || []).map((group) => (group && group.options) || [])));
    const option = options.find((entry) => entry && entry.id === option_id);
    return `${translate("DCS_TRANSLATION_OPTION")}: ${option ? get_field_text(option.label, language) || option.value : ""}`;
  }
  const keys = { label: field && field.type === "header" ? "DCS_TRANSLATION_HEADING_TEXT" : "DCS_TRANSLATION_KIND_LABEL", content: "DCS_TRANSLATION_KIND_CONTENT", placeholder: "DCS_TRANSLATION_KIND_PLACEHOLDER", help_text: "DCS_TRANSLATION_KIND_HELP_TEXT", low_label: "DCS_TRANSLATION_LOW", high_label: "DCS_TRANSLATION_HIGH" };
  return translate(keys[head] || "DCS_TRANSLATION_KIND_LABEL");
}

function TranslatorList({ translators, proposals, onOpen, translate }) {
  if (translators.length === 0) {
    return (
      <p className="text-sm" style={{ color: MUTED, ...FONT }}>
        {translate("DCS_TRANSLATION_NO_TRANSLATORS")}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {translators.map((person) => {
        const own = proposals.filter((proposal) => proposal.translator && proposal.translator.email === person.email);
        const pending = own.filter((proposal) => proposal.status === "pending").length;
        const applied = own.filter((proposal) => proposal.status === "applied").length;
        return (
          <button key={person.email} type="button" onClick={() => onOpen(person)} className="w-full text-left cok-auth-card p-3 sm:p-4 flex items-center justify-between gap-3 cursor-pointer">
            <div className="min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: TEXT, ...FONT }}>{person.name}</p>
              <p className="text-xs truncate" style={{ color: MUTED, ...FONT }}>{[person.email, person.phone].filter(Boolean).join(" - ")}</p>
              <p className="text-xs" style={{ color: MUTED, ...FONT }}>
                {translate("DCS_TRANSLATION_PENDING_SHORT", { count: pending })}, {translate("DCS_TRANSLATION_APPLIED_SHORT", { count: applied })} - {translate("DCS_TRANSLATION_LAST_PAGE", { page: (person.last_page || 0) + 1 })}
              </p>
            </div>
            <span className="text-xs font-bold uppercase flex-shrink-0" style={{ color: PRIMARY, ...FONT }}>
              {translate("DCS_TRANSLATION_OPEN")}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * What the translators of one link proposed, for the form's editor. First
 * the translators by name; opening one shows the WHOLE form in order, field
 * by field, with that person's proposed texts beside what the form holds
 * now and a tick on each - fields they left untouched read "no change".
 * Apply writes the ticked pending texts into the form; Restore puts the
 * remembered text back for ticked applied ones; Dismiss drops pending ones.
 */
export default function TranslationReviewDialog({ formGroupId, link, fields, onClose, onChanged }) {
  const { translate, language } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const [proposals, setProposals] = useState([]);
  const [translators, setTranslators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [person, setPerson] = useState(null);
  const [page, setPage] = useState(0);

  const reload = () =>
    list_translation_proposals(formGroupId, link.id)
      .then((response) => {
        setProposals((response.data && response.data.proposals) || []);
        setTranslators((response.data && response.data.translators) || []);
      })
      .catch((error) => showError(error.message || translate("DCS_ERROR_GENERIC")))
      .finally(() => setLoading(false));

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link.id]);

  const entries = useMemo(() => translatable_entries(fields || [], translate, language), [fields, translate, language]);
  const own = useMemo(() => (person ? proposals.filter((proposal) => proposal.translator && proposal.translator.email === person.email) : []), [proposals, person]);
  const by_field = useMemo(() => {
    const map = new Map();
    own.forEach((proposal) => {
      if (!map.has(proposal.field_id)) map.set(proposal.field_id, []);
      map.get(proposal.field_id).push(proposal);
    });
    return map;
  }, [own]);
  const pages = page_count(entries.length, FIELDS_PER_REVIEW_PAGE);
  const shown = page_slice(entries, Math.min(page, pages - 1), FIELDS_PER_REVIEW_PAGE);

  const toggle = (id) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const select_all = () => setSelected(new Set(own.map((item) => item.id)));

  // Each action takes only the ticked texts it can act on: Apply and
  // Dismiss the pending (Dismiss also the restored), Restore the applied.
  const ticked = own.filter((proposal) => selected.has(proposal.id));
  const ids_for = (statuses) => ticked.filter((proposal) => statuses.includes(proposal.status)).map((proposal) => proposal.id);
  const apply_ids = ids_for(["pending"]);
  const restore_ids = ids_for(["applied"]);
  const dismiss_ids = ids_for(["pending", "restored"]);

  // Applied and restored texts keep their ticks (same ids, new state), so
  // Apply can be followed by Restore at once; dismissed ones are gone.
  const act = async (action, ids, done_key, clear) => {
    if (ids.length === 0) {
      showError(translate("DCS_TRANSLATION_NOTHING_SELECTED"));
      return;
    }
    setBusy(true);
    try {
      const response = await action(formGroupId, link.id, ids);
      showSuccess(response.message || translate(done_key));
      if (clear) setSelected(new Set());
      await reload();
      if (onChanged) onChanged();
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setBusy(false);
    }
  };

  const open_person = (next) => {
    setPerson(next);
    setSelected(new Set());
    setPage(0);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={busy ? undefined : onClose} />
      <div className="relative bg-white w-full max-w-3xl h-full sm:h-auto sm:max-h-[92vh] flex flex-col cok-auth-card">
        <div className="p-4 sm:p-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold truncate" style={{ color: TEXT, ...FONT }}>
              {person ? person.name : `${translate("DCS_TRANSLATION_REVIEW_TITLE")} - ${link.title}`}
            </h2>
            <p className="text-xs mt-1" style={{ color: MUTED, ...FONT }}>
              {person ? [person.email, person.phone].filter(Boolean).join(" - ") : translate("DCS_TRANSLATION_TRANSLATORS_HINT")}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {person && (
              <DcsButtonOutline onClick={() => open_person(null)} disabled={busy}>
                {translate("DCS_TRANSLATION_BACK_TO_LIST")}
              </DcsButtonOutline>
            )}
            <DcsButtonOutline onClick={onClose} disabled={busy}>
              {translate("DCS_BTN_CLOSE")}
            </DcsButtonOutline>
          </div>
        </div>

        <div className="px-4 sm:px-5 pb-4 overflow-y-auto space-y-3 flex-1">
          {loading && (
            <p className="text-sm" style={{ color: MUTED, ...FONT }}>
              {translate("DCS_WAITING_GENERIC")}
            </p>
          )}
          {!loading && !person && <TranslatorList translators={translators} proposals={proposals} onOpen={open_person} translate={translate} />}
          {!loading &&
            person &&
            shown.map((entry, index) => {
              const field = entry.field;
              const items = by_field.get(field.id) || [];
              const label = get_field_text(field.label, language) || (field.type === "paragraph" ? get_field_text(field.content, language) : "");
              return (
                <div key={field.id} className="p-3 sm:p-4 space-y-2" style={{ backgroundColor: "#F7F9FB" }}>
                  <p className="text-xs font-bold" style={{ color: items.length > 0 ? PRIMARY : MUTED, ...FONT }}>
                    {page * FIELDS_PER_REVIEW_PAGE + index + 1}. {field_type_name(field.type, translate)}
                    {label ? ` - ${String(label).slice(0, 80)}` : ""}
                  </p>
                  {items.length === 0 && (
                    <p className="text-xs" style={{ color: MUTED, ...FONT }}>
                      {translate("DCS_TRANSLATION_NO_CHANGE_FIELD")}
                    </p>
                  )}
                  {items.map((item) => (
                    <label key={item.id} className="grid gap-2 p-3 cursor-pointer bg-white" style={{ gridTemplateColumns: "auto 1fr" }}>
                      <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} disabled={busy} style={{ accentColor: PRIMARY, marginTop: 4 }} />
                      <div className="min-w-0 space-y-1">
                        <p className="text-[11px] font-bold uppercase flex items-center gap-2 flex-wrap" style={{ color: PRIMARY, ...FONT }}>
                          <span>{translate(LANGUAGE_NAME_KEYS[item.language] || "DCS_TRANSLATION_LANG_EN")}</span>
                          <span style={{ color: TEXT, textTransform: "none", fontWeight: 600 }}>{row_title(item.path, field, translate, language)}</span>
                          <span style={{ color: STATUS_COLOR[item.status] || MUTED }}>{translate(STATUS_KEY[item.status] || "DCS_TRANSLATION_STATUS_PENDING")}</span>
                        </p>
                        <p className="text-xs" style={{ color: MUTED, ...FONT }}>
                          {translate("DCS_TRANSLATION_CURRENT")}: <span style={{ color: TEXT, whiteSpace: "pre-wrap" }}>{item.current_value || translate("DCS_TRANSLATION_EMPTY_TEXT")}</span>
                        </p>
                        <p className="text-sm" style={{ color: TEXT, whiteSpace: "pre-wrap", ...FONT }}>
                          {translate("DCS_TRANSLATION_PROPOSED")}: <strong>{item.value || translate("DCS_TRANSLATION_EMPTY_TEXT")}</strong>
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              );
            })}
        </div>

        {person && (
          <div className="p-4 sm:p-5 space-y-2" style={{ boxShadow: "0 -4px 16px rgba(0,0,0,0.06)" }}>
            <div className="flex items-center justify-between gap-2">
              <DcsButtonOutline onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0 || busy}>
                {translate("DCS_TRANSLATION_BACK")}
              </DcsButtonOutline>
              <button type="button" className="text-xs underline cursor-pointer bg-transparent border-0" style={{ color: PRIMARY, ...FONT }} onClick={select_all} disabled={busy}>
                {translate("DCS_TRANSLATION_SELECT_ALL")} - {translate("DCS_TRANSLATION_PAGE_OF", { page: Math.min(page, pages - 1) + 1, total: pages })}
              </button>
              <DcsButtonOutline onClick={() => setPage(Math.min(pages - 1, page + 1))} disabled={page >= pages - 1 || busy}>
                {translate("DCS_TRANSLATION_NEXT")}
              </DcsButtonOutline>
            </div>
            <p className="text-xs" style={{ color: MUTED, ...FONT }}>
              {translate("DCS_TRANSLATION_TICKED_HINT", { pending: apply_ids.length, applied: restore_ids.length })}
            </p>
            <div className="flex gap-2 flex-wrap justify-end">
              <DcsButtonOutline onClick={() => act(dismiss_translation_proposals, dismiss_ids, "DCS_TRANSLATION_DISMISSED_TOAST", true)} disabled={busy || dismiss_ids.length === 0}>
                {translate("DCS_TRANSLATION_DISMISS_SELECTED")} ({dismiss_ids.length})
              </DcsButtonOutline>
              <DcsButtonOutline onClick={() => act(restore_translation_proposals, restore_ids, "DCS_TRANSLATION_RESTORED_TOAST")} disabled={busy || restore_ids.length === 0}>
                {translate("DCS_TRANSLATION_RESTORE_SELECTED")} ({restore_ids.length})
              </DcsButtonOutline>
              <DcsButtonPrimary onClick={() => act(apply_translation_proposals, apply_ids, "DCS_TRANSLATION_APPLIED_TOAST")} disabled={busy || apply_ids.length === 0}>
                {busy ? translate("DCS_WAITING_GENERIC") : `${translate("DCS_TRANSLATION_APPLY_SELECTED")} (${apply_ids.length})`}
              </DcsButtonPrimary>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
