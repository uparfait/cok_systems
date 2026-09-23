import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { DCS_FIELD_TYPE_REGISTRY } from "../fields/fieldTypes.js";
import { empty_tracking, key_candidates, editable_candidates, field_name, is_tracking_enabled } from "./trackingConfig.js";
import DcsWizardSteps from "../components/DcsWizardSteps.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsButtonOutlineDanger from "../components/DcsButtonOutlineDanger.jsx";
import DcsButtonOutlineReverse from "../components/DcsButtonOutlineReverse.jsx";
import DcsFieldIcon from "../components/DcsFieldIcon.jsx";

const PRIMARY = "#056daa";
const MUTED = "#9E9E9E";
const TEXT = "#333333";
const BORDER = "#E0E0E0";
const FONT = "'Montserrat', sans-serif";

const STEPS = [
  { key: "key", labelKey: "DCS_TRACKING_STEP_KEY" },
  { key: "fields", labelKey: "DCS_TRACKING_STEP_FIELDS" },
  { key: "review", labelKey: "DCS_TRACKING_STEP_REVIEW" },
];

function type_label(field_type, translate) {
  const entry = DCS_FIELD_TYPE_REGISTRY.find((candidate) => candidate.type === field_type);
  return entry ? translate(entry.labelKey) : field_type;
}

function matches(field, query, language) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return field_name(field, language).toLowerCase().includes(needle) || field.id.toLowerCase().includes(needle);
}

/** One field in a pick list: its icon, its name and its type, with a radio or a checkbox. */
function FieldRow({ field, checked, kind, onToggle, language, translate, name }) {
  return (
    <label className="dcs-tracking-row" style={{ borderColor: checked ? PRIMARY : BORDER, backgroundColor: checked ? "rgba(5,109,170,0.06)" : "#FFFFFF" }}>
      <input type={kind} name={name} checked={checked} onChange={onToggle} style={{ accentColor: PRIMARY, flexShrink: 0 }} />
      <DcsFieldIcon type={field.type} className="flex-shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold truncate" style={{ color: TEXT, fontFamily: FONT }}>
          {field_name(field, language)}
        </span>
        <span className="block text-xs truncate" style={{ color: MUTED }}>
          {type_label(field.type, translate)}
        </span>
      </span>
    </label>
  );
}

/**
 * The record tracking setup, in steps: 1 the key field (and whether one
 * key means one record), 2 the fields a later update may change, 3 a
 * summary to save. Full screen on a phone, a centered card from tablet
 * width up. Saving hands the config back; the form itself is published
 * by the builder's own Publish, as for every other setting.
 */
export default function TrackingSetupOverlay({ fields, tracking, onSave, onClose }) {
  const { translate, language } = useDcsLanguage();
  const [draft, setDraft] = useState(() => Object.assign(empty_tracking(), tracking || {}, { enabled: true }));
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState("");

  const keys = useMemo(() => key_candidates(fields), [fields]);
  const editable = useMemo(() => editable_candidates(fields, draft.key_field_id), [fields, draft.key_field_id]);
  const key_field = keys.find((field) => field.id === draft.key_field_id) || null;
  const chosen = new Set(draft.editable_field_ids || []);
  const max_reached = key_field ? 2 : 0;

  const set_key = (field_id) => setDraft((previous) => Object.assign({}, previous, { key_field_id: field_id, editable_field_ids: (previous.editable_field_ids || []).filter((id) => id !== field_id) }));
  const toggle_field = (field_id) => {
    setDraft((previous) => {
      const list = previous.editable_field_ids || [];
      return Object.assign({}, previous, { editable_field_ids: list.includes(field_id) ? list.filter((id) => id !== field_id) : list.concat([field_id]) });
    });
  };
  const set_all = (on) => setDraft((previous) => Object.assign({}, previous, { editable_field_ids: on ? editable.map((field) => field.id) : [] }));

  const can_save = !!key_field && chosen.size > 0;
  const visible_keys = keys.filter((field) => matches(field, query, language));
  const visible_editable = editable.filter((field) => matches(field, query, language));

  return createPortal(
    <div className="dcs-tracking-overlay">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="dcs-tracking-panel">
        <div className="cok-bg-primary px-4 py-3 flex items-center justify-between gap-2 flex-shrink-0">
          <span className="text-white font-semibold uppercase tracking-wide text-sm truncate" style={{ fontFamily: FONT }}>
            {translate("DCS_TRACKING_TITLE")}
          </span>
          <DcsButtonOutlineReverse onClick={onClose}>{translate("DCS_BTN_CLOSE")}</DcsButtonOutlineReverse>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-3">
          <DcsWizardSteps steps={STEPS} currentIndex={step} maxReachedIndex={max_reached} onSelect={setStep} />

          <p className="text-xs mb-3" style={{ color: MUTED, fontFamily: FONT }}>
            {translate(step === 0 ? "DCS_TRACKING_STEP_KEY_HINT" : step === 1 ? "DCS_TRACKING_STEP_FIELDS_HINT" : "DCS_TRACKING_STEP_REVIEW_HINT")}
          </p>

          {step < 2 && (
            <input
              type="text"
              className="cok-auth-input w-full py-2 mb-3"
              placeholder={translate("DCS_SEARCH_FIELD_PLACEHOLDER")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          )}

          {step === 0 && (
            <div className="space-y-2">
              {keys.length === 0 && (
                <p className="text-xs py-6 text-center" style={{ color: MUTED }}>{translate("DCS_TRACKING_NO_KEY_CANDIDATES")}</p>
              )}
              {visible_keys.map((field) => (
                <FieldRow key={field.id} field={field} kind="radio" name="dcs_tracking_key" checked={draft.key_field_id === field.id} onToggle={() => set_key(field.id)} language={language} translate={translate} />
              ))}

              {key_field && (
                <div className="border p-3 mt-3 space-y-2" style={{ borderColor: BORDER, backgroundColor: "#F7F9FB" }}>
                  <label className="cok-auth-label mb-0">{translate("DCS_TRACKING_UNIQUE_LABEL")}</label>
                  <div className="flex flex-col min-[480px]:flex-row gap-2 min-[480px]:gap-5">
                    <label className="flex items-center gap-2 text-sm" style={{ color: TEXT }}>
                      <input type="radio" checked={draft.key_unique !== false} onChange={() => setDraft((previous) => Object.assign({}, previous, { key_unique: true }))} style={{ accentColor: PRIMARY }} />
                      {translate("DCS_TRACKING_UNIQUE_YES")}
                    </label>
                    <label className="flex items-center gap-2 text-sm" style={{ color: TEXT }}>
                      <input type="radio" checked={draft.key_unique === false} onChange={() => setDraft((previous) => Object.assign({}, previous, { key_unique: false }))} style={{ accentColor: PRIMARY }} />
                      {translate("DCS_TRACKING_UNIQUE_NO")}
                    </label>
                  </div>
                  <p className="text-xs" style={{ color: MUTED }}>{translate(draft.key_unique !== false ? "DCS_TRACKING_UNIQUE_YES_HINT" : "DCS_TRACKING_UNIQUE_NO_HINT")}</p>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold" style={{ color: PRIMARY, fontFamily: FONT }}>
                  {translate("DCS_TRACKING_CHOSEN_COUNT", { count: chosen.size, total: editable.length })}
                </span>
                <span className="flex gap-3">
                  <button type="button" onClick={() => set_all(true)} className="text-xs cursor-pointer underline bg-transparent border-0" style={{ color: PRIMARY }}>{translate("DCS_BTN_SELECT_ALL")}</button>
                  <button type="button" onClick={() => set_all(false)} className="text-xs cursor-pointer underline bg-transparent border-0" style={{ color: PRIMARY }}>{translate("DCS_BTN_SELECT_NONE")}</button>
                </span>
              </div>
              {visible_editable.map((field) => (
                <FieldRow key={field.id} field={field} kind="checkbox" checked={chosen.has(field.id)} onToggle={() => toggle_field(field.id)} language={language} translate={translate} />
              ))}
              {editable.length === 0 && (
                <p className="text-xs py-6 text-center" style={{ color: MUTED }}>{translate("DCS_TRACKING_NO_EDITABLE_CANDIDATES")}</p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="border p-3" style={{ borderColor: BORDER }}>
                <p className="text-[11px] font-bold uppercase" style={{ color: MUTED, fontFamily: FONT, letterSpacing: 0.5 }}>{translate("DCS_TRACKING_STEP_KEY")}</p>
                <p className="text-sm font-semibold mt-1" style={{ color: TEXT, fontFamily: FONT }}>{field_name(key_field, language)}</p>
                <p className="text-xs mt-1" style={{ color: MUTED }}>{translate(draft.key_unique !== false ? "DCS_TRACKING_UNIQUE_YES" : "DCS_TRACKING_UNIQUE_NO")}</p>
              </div>
              <div className="border p-3" style={{ borderColor: BORDER }}>
                <p className="text-[11px] font-bold uppercase" style={{ color: MUTED, fontFamily: FONT, letterSpacing: 0.5 }}>
                  {translate("DCS_TRACKING_STEP_FIELDS")} ({chosen.size})
                </p>
                <ul className="mt-1 space-y-1">
                  {editable.filter((field) => chosen.has(field.id)).map((field) => (
                    <li key={field.id} className="text-sm flex items-center gap-2" style={{ color: TEXT }}>
                      <DcsFieldIcon type={field.type} className="flex-shrink-0" />
                      <span className="truncate">{field_name(field, language)}</span>
                    </li>
                  ))}
                </ul>
                {chosen.size === 0 && <p className="text-xs mt-1" style={{ color: "#E74C3C" }}>{translate("DCS_TRACKING_FIELDS_REQUIRED")}</p>}
              </div>
              <p className="text-xs" style={{ color: MUTED, fontFamily: FONT }}>{translate("DCS_TRACKING_PUBLISH_NOTE")}</p>
            </div>
          )}
        </div>

        <div className="dcs-tracking-footer">
          {is_tracking_enabled(tracking) && (
            <DcsButtonOutlineDanger onClick={() => onSave(empty_tracking())}>{translate("DCS_TRACKING_DISABLE")}</DcsButtonOutlineDanger>
          )}
          <span className="flex-1" />
          {step > 0 && <DcsButtonOutline onClick={() => setStep(step - 1)}>{translate("DCS_BTN_BACK")}</DcsButtonOutline>}
          {step < 2 && (
            <DcsButtonPrimary onClick={() => setStep(step + 1)} disabled={step === 0 ? !key_field : chosen.size === 0}>
              {translate("DCS_BTN_NEXT")}
            </DcsButtonPrimary>
          )}
          {step === 2 && (
            <DcsButtonPrimary onClick={() => onSave(Object.assign({}, draft, { enabled: true }))} disabled={!can_save}>
              {translate("DCS_BTN_SAVE")}
            </DcsButtonPrimary>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
