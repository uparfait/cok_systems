import React, { useRef, useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { useToast } from "../../../../core/contexts/ToastContext.tsx";
import DcsButtonPrimary from "../../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../../components/DcsButtonOutline.jsx";
import { Step, ChipGrid, Problem, Preview, TitleFields, TEXT_MUTED, BORDER } from "./builderUi.jsx";
import ColorSettingsButton from "./ColorSettingsButton.jsx";
import ColorInput from "./ColorInput.jsx";
import TextWidget from "../charts/TextWidget.jsx";
import { build_palette } from "../appearance.js";
import { EMPTY_TEXT_SPEC, TEXT_ALIGNS, TEXT_SIZES, MAX_HEADING, MAX_BODY, text_spec_problems, build_text_draft } from "./textCompose.js";
import TextVariableInsert from "./TextVariableInsert.jsx";
import { has_text_variables } from "../textVariables.js";
import { get_dashboard_data, request_error_text } from "../dashboardService.js";

const SIZES = ["small", "medium", "large"];

/**
 * The Text tab of the builder: a heading, a body in the light markup the
 * block understands, how it is set (alignment, size, the accent colour of
 * ==highlighted== words), then the card's optional title and its colours.
 * A live preview draws the block as the board will, in the colours chosen.
 * With initialSpec it reopens an existing block for editing.
 */
export default function TextComposer({ form, fields, onAdd, disabled, initialSpec, editing, onCancelEdit }) {
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const [spec, setSpec] = useState(initialSpec || EMPTY_TEXT_SPEC);
  // The body's textarea, so a figure is inserted where the cursor is.
  const body_ref = useRef(null);
  // The figures computed for the preview, when asked for.
  const [live, setLive] = useState(null);
  const [computing, setComputing] = useState(false);
  const insert_token = (token) => {
    const element = body_ref.current;
    const body = String(spec.body || "");
    const start = element ? element.selectionStart : body.length;
    const end = element ? element.selectionEnd : body.length;
    const next = `${body.slice(0, start)}${token}${body.slice(end)}`;
    patch({ body: next });
    setLive(null);
    window.setTimeout(() => {
      if (!element) return;
      element.focus();
      element.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  };
  const compute_preview = async () => {
    setComputing(true);
    try {
      const draft = build_text_draft(form, spec)[0];
      const response = await get_dashboard_data(form.form_group_id, [draft], null);
      const result = ((response.data && response.data.results) || [])[0];
      if (!result || result.error) throw new Error((result && result.messages && result.messages[0]) || translate("DCS_ERROR_GENERIC"));
      setLive(result);
    } catch (error) {
      showError(request_error_text(error, translate("DCS_ERROR_GENERIC")));
    } finally {
      setComputing(false);
    }
  };
  const patch = (changes) => setSpec((current) => ({ ...current, ...changes }));
  const problems = text_spec_problems(spec, translate);
  const ready = problems.length === 0;
  const palette = build_palette(spec.appearance);
  const preview_widget = { chart_type: "text", text: { heading: spec.heading, body: spec.body, align: spec.align, size: spec.size, accent: /^#[0-9a-f]{6}$/i.test(spec.accent || "") ? spec.accent : undefined }, appearance: spec.appearance };
  const has_live = has_text_variables(preview_widget);

  const handle_add = () => {
    if (!ready) return;
    const widgets = build_text_draft(form, spec);
    onAdd({
      tab: "text",
      summary: (spec.title || spec.heading || String(spec.body || "").slice(0, 60)).trim(),
      detail: translate("DCS_DB_CHART_TEXT"),
      with_chart: "",
      widgets,
      spec,
    });
    showSuccess(editing ? translate("DCS_DB_DRAFT_UPDATED") : translate("DCS_DB_TEXT_ADDED"));
    setSpec(EMPTY_TEXT_SPEC);
  };

  return (
    <div className="dcs-view-swap flex flex-col gap-5">
      {editing && <Preview>{translate("DCS_DB_DRAFT_EDITING")}</Preview>}
      <p className="text-xs" style={{ color: TEXT_MUTED }}>{translate("DCS_DB_TEXT_INTRO")}</p>

      <Step number={1} titleKey="DCS_DB_STEP_TEXT_WORDS" hintKey="DCS_DB_TEXT_BODY_HINT">
        <input className="cok-auth-input w-full py-2" placeholder={translate("DCS_DB_TEXT_HEADING")} value={spec.heading} maxLength={MAX_HEADING} disabled={disabled} onChange={(event) => patch({ heading: event.target.value })} />
        <textarea ref={body_ref} className="cok-auth-input w-full py-2 mt-2" rows={6} maxLength={MAX_BODY} placeholder={translate("DCS_DB_TEXT_BODY")} value={spec.body} disabled={disabled} onChange={(event) => { patch({ body: event.target.value }); setLive(null); }} />
        <div className="mt-3">
          <TextVariableInsert fields={fields || []} onInsert={insert_token} disabled={disabled} />
        </div>
      </Step>

      <Step number={2} titleKey="DCS_DB_STEP_TEXT_LOOK">
        <p className="text-xs mb-1" style={{ color: TEXT_MUTED }}>{translate("DCS_DB_TEXT_ALIGN")}</p>
        <ChipGrid options={TEXT_ALIGNS.map((align) => ({ id: align, label: translate(`DCS_DB_TEXT_ALIGN_${align.toUpperCase()}`) }))} value={spec.align} onChange={(align) => patch({ align })} disabled={disabled} columns="grid-cols-3 sm:w-80" />
        <p className="text-xs mb-1 mt-3" style={{ color: TEXT_MUTED }}>{translate("DCS_DB_TEXT_SIZE")}</p>
        <ChipGrid options={TEXT_SIZES.map((size) => ({ id: size, label: translate(`DCS_DB_TEXT_SIZE_${size.toUpperCase()}`) }))} value={spec.size} onChange={(size) => patch({ size })} disabled={disabled} columns="grid-cols-3 sm:w-80" />
        <p className="text-xs mb-1 mt-3" style={{ color: TEXT_MUTED }}>{translate("DCS_DB_TEXT_ACCENT_HINT")}</p>
        <ColorInput label={translate("DCS_DB_TEXT_ACCENT")} value={spec.accent || ""} fallback={palette.number} autoTag={translate("DCS_DB_COLOR_AUTO_TAG")} onChange={(accent) => patch({ accent })} onClear={spec.accent ? () => patch({ accent: "" }) : null} />
        <p className="text-xs mb-1 mt-3" style={{ color: TEXT_MUTED }}>{translate("DCS_DB_SIZE")}</p>
        <ChipGrid options={SIZES.map((size) => ({ id: size, label: translate(`DCS_DB_SIZE_${size.toUpperCase()}`) }))} value={spec.board_size} onChange={(board_size) => patch({ board_size })} disabled={disabled} columns="grid-cols-3 sm:w-80" />
      </Step>

      <Step number={3} titleKey="DCS_DB_STEP_DETAILS" hintKey="DCS_DB_TEXT_TITLE_OPTIONAL">
        <TitleFields title={spec.title} description={spec.description} onTitle={(title) => patch({ title })} onDescription={(description) => patch({ description })} disabled={disabled} />
      </Step>

      <Step number={4} titleKey="DCS_DB_STEP_COLORS" hintKey="DCS_DB_STEP_COLORS_HINT">
        <ColorSettingsButton form={form} title={spec.title || spec.heading} valuesField={null} appearance={spec.appearance} onChange={(appearance) => patch({ appearance })} disabled={disabled} />
      </Step>

      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-xs font-bold uppercase" style={{ color: TEXT_MUTED, letterSpacing: "0.5px" }}>{translate("DCS_DB_TEXT_PREVIEW")}</p>
          {has_live && (
            <button type="button" className="text-xs cursor-pointer" style={{ color: "#056daa", background: "none", border: "none", padding: 0, textDecoration: "underline" }} disabled={disabled || computing} onClick={compute_preview}>
              {translate(computing ? "DCS_DB_TEXT_PREVIEW_LOADING" : "DCS_DB_TEXT_PREVIEW_LIVE")}
            </button>
          )}
        </div>
        <div className="border-2 px-3 py-2" style={{ borderColor: palette.border || BORDER, backgroundColor: palette.background }}>
          {ready ? <TextWidget widget={preview_widget} palette={palette} data={live} /> : <p className="text-xs" style={{ color: palette.muted }}>{translate("DCS_DB_TEXT_NEED_WORDS")}</p>}
        </div>
        <Problem>{spec.heading || spec.body ? problems[0] : ""}</Problem>
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <DcsButtonPrimary className="sm:w-56" disabled={disabled || !ready} onClick={handle_add}>
            {editing ? translate("DCS_DB_DRAFT_UPDATE") : translate("DCS_DB_ADD_TEXT")}
          </DcsButtonPrimary>
          {editing ? (
            <DcsButtonOutline className="sm:w-36" disabled={disabled} onClick={onCancelEdit}>
              {translate("DCS_DB_DRAFT_CANCEL_EDIT")}
            </DcsButtonOutline>
          ) : (
            <DcsButtonOutline className="sm:w-32" disabled={disabled} onClick={() => setSpec(EMPTY_TEXT_SPEC)}>
              {translate("DCS_DB_RESET")}
            </DcsButtonOutline>
          )}
        </div>
      </div>
    </div>
  );
}
