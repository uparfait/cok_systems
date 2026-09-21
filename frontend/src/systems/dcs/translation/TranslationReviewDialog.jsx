import React, { useEffect, useMemo, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { list_translation_proposals, apply_translation_proposals, restore_translation_proposals, dismiss_translation_proposals } from "../services/formsService.js";
import { get_field_text } from "../fields/fieldText.js";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import { flatten_all_fields, field_type_name, LANGUAGE_NAME_KEYS, page_count, page_slice } from "./translationTexts.js";

const FONT = { fontFamily: "'Montserrat', sans-serif" };
const BORDER = "#E0E0E0";
const MUTED = "#9E9E9E";
const PRIMARY = "#056daa";
const TEXT = "#333333";
const AMBER = "#B9770E";
const GREEN = "#1f8a4c";

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

/**
 * What one translation link's translator proposed, for the form's editor:
 * three fields per page, every proposal with the text the form holds now
 * beside the proposed one, a status, and a tick. Apply writes the ticked
 * pending texts into the form; Restore puts the remembered text back for
 * ticked applied ones; Dismiss drops ticked pending ones.
 */
export default function TranslationReviewDialog({ formGroupId, link, fields, onClose, onChanged }) {
  const { translate, language } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [page, setPage] = useState(0);

  const fields_by_id = useMemo(() => new Map(flatten_all_fields(fields || []).map((entry) => [entry.field.id, entry.field])), [fields]);

  const reload = () =>
    list_translation_proposals(formGroupId, link.id)
      .then((response) => setProposals((response.data && response.data.proposals) || []))
      .catch((error) => showError(error.message || translate("DCS_ERROR_GENERIC")))
      .finally(() => setLoading(false));

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link.id]);

  // Grouped per field, in the form's order.
  const groups = useMemo(() => {
    const order = new Map(Array.from(fields_by_id.keys()).map((id, index) => [id, index]));
    const by_field = new Map();
    proposals.forEach((proposal) => {
      if (!by_field.has(proposal.field_id)) by_field.set(proposal.field_id, []);
      by_field.get(proposal.field_id).push(proposal);
    });
    return Array.from(by_field.entries())
      .sort((a, b) => (order.get(a[0]) ?? 99999) - (order.get(b[0]) ?? 99999))
      .map(([field_id, items]) => ({ field_id, field: fields_by_id.get(field_id) || null, items }));
  }, [proposals, fields_by_id]);
  const pages = page_count(groups.length);
  const shown = page_slice(groups, Math.min(page, pages - 1));

  const toggle = (id) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const select_page = () => setSelected(new Set(shown.flatMap((group) => group.items.map((item) => item.id))));

  const act = async (action, status, done_key) => {
    const ids = proposals.filter((proposal) => selected.has(proposal.id) && proposal.status === status).map((proposal) => proposal.id);
    if (ids.length === 0) {
      showError(translate("DCS_TRANSLATION_NOTHING_SELECTED"));
      return;
    }
    setBusy(true);
    try {
      const response = await action(formGroupId, link.id, ids);
      showSuccess(response.message || translate(done_key));
      setSelected(new Set());
      await reload();
      if (onChanged) onChanged();
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setBusy(false);
    }
  };

  const counts = proposals.reduce((sum, proposal) => Object.assign(sum, { [proposal.status]: (sum[proposal.status] || 0) + 1 }), {});

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={busy ? undefined : onClose} />
      <div className="relative bg-white border-2 w-full max-w-3xl max-h-[92vh] flex flex-col" style={{ borderColor: BORDER }}>
        <div className="p-4 sm:p-5 flex items-start justify-between gap-3 border-b" style={{ borderColor: BORDER }}>
          <div className="min-w-0">
            <h2 className="text-base font-bold truncate" style={{ color: TEXT, ...FONT }}>
              {translate("DCS_TRANSLATION_REVIEW_TITLE")} - {link.title}
            </h2>
            <p className="text-xs mt-1" style={{ color: MUTED, ...FONT }}>
              {translate("DCS_TRANSLATION_REVIEW_HINT")} {translate("DCS_TRANSLATION_PENDING_SHORT", { count: counts.pending || 0 })}, {translate("DCS_TRANSLATION_APPLIED_SHORT", { count: counts.applied || 0 })}.
            </p>
          </div>
          <DcsButtonOutline onClick={onClose} disabled={busy}>
            {translate("DCS_BTN_CLOSE")}
          </DcsButtonOutline>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {loading && (
            <p className="text-sm" style={{ color: MUTED, ...FONT }}>
              {translate("DCS_WAITING_GENERIC")}
            </p>
          )}
          {!loading && groups.length === 0 && (
            <p className="text-sm" style={{ color: MUTED, ...FONT }}>
              {translate("DCS_TRANSLATION_NO_PROPOSALS")}
            </p>
          )}
          {shown.map((group) => (
            <div key={group.field_id} className="p-3 sm:p-4 space-y-3 cok-auth-card">
              <p className="text-xs font-bold uppercase" style={{ color: PRIMARY, ...FONT }}>
                {group.field ? field_type_name(group.field.type, translate) : translate("DCS_TRANSLATION_KIND_LABEL")}
                {group.field && group.field.label && get_field_text(group.field.label, language) ? ` - ${get_field_text(group.field.label, language)}` : ""}
              </p>
              {group.items.map((item) => (
                <label key={item.id} className="grid gap-2 p-3 cursor-pointer" style={{ gridTemplateColumns: "auto 1fr", backgroundColor: "#F7F9FB" }}>
                  <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} disabled={busy} style={{ accentColor: PRIMARY, marginTop: 4 }} />
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ color: "#FFFFFF", backgroundColor: PRIMARY, ...FONT }}>
                        {translate(LANGUAGE_NAME_KEYS[item.language] || "DCS_TRANSLATION_LANG_EN")}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: TEXT, ...FONT }}>
                        {row_title(item.path, group.field, translate, language)}
                      </span>
                      <span className="text-[10px] font-bold uppercase" style={{ color: STATUS_COLOR[item.status] || MUTED, ...FONT }}>
                        {translate(STATUS_KEY[item.status] || "DCS_TRANSLATION_STATUS_PENDING")}
                      </span>
                    </div>
                    {item.translator && (
                      <p className="text-xs" style={{ color: MUTED, ...FONT }}>
                        {translate("DCS_TRANSLATION_BY", { name: item.translator.name })}
                        {item.translator.email ? ` - ${item.translator.email}` : ""}
                        {item.translator.phone ? ` - ${item.translator.phone}` : ""}
                      </p>
                    )}
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
          ))}
        </div>

        <div className="p-4 sm:p-5 border-t space-y-2" style={{ borderColor: BORDER }}>
          <div className="flex items-center justify-between gap-2">
            <DcsButtonOutline onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0 || busy}>
              {translate("DCS_TRANSLATION_BACK")}
            </DcsButtonOutline>
            <button type="button" className="text-xs underline cursor-pointer" style={{ color: PRIMARY, ...FONT }} onClick={select_page} disabled={busy}>
              {translate("DCS_TRANSLATION_SELECT_PAGE")} - {translate("DCS_TRANSLATION_PAGE_OF", { page: Math.min(page, pages - 1) + 1, total: pages })}
            </button>
            <DcsButtonOutline onClick={() => setPage(Math.min(pages - 1, page + 1))} disabled={page >= pages - 1 || busy}>
              {translate("DCS_TRANSLATION_NEXT")}
            </DcsButtonOutline>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <DcsButtonOutline onClick={() => act(dismiss_translation_proposals, "pending", "DCS_TRANSLATION_DISMISSED_TOAST")} disabled={busy || selected.size === 0}>
              {translate("DCS_TRANSLATION_DISMISS_SELECTED")}
            </DcsButtonOutline>
            <DcsButtonOutline onClick={() => act(restore_translation_proposals, "applied", "DCS_TRANSLATION_RESTORED_TOAST")} disabled={busy || selected.size === 0}>
              {translate("DCS_TRANSLATION_RESTORE_SELECTED")}
            </DcsButtonOutline>
            <DcsButtonPrimary onClick={() => act(apply_translation_proposals, "pending", "DCS_TRANSLATION_APPLIED_TOAST")} disabled={busy || selected.size === 0}>
              {busy ? translate("DCS_WAITING_GENERIC") : translate("DCS_TRANSLATION_APPLY_SELECTED")}
            </DcsButtonPrimary>
          </div>
        </div>
      </div>
    </div>
  );
}
