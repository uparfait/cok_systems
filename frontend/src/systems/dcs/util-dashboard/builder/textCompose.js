import { behavior_spec, with_behavior } from "./widgetBehavior.js";

/**
 * The pure side of the Text tab: the empty spec, what stops a block being
 * built, and the widget document one becomes. A text block reads no field,
 * so there is nothing to classify here - only words and how they are set.
 */

export const TEXT_ALIGNS = ["left", "center", "right"];
export const TEXT_SIZES = ["sm", "md", "lg"];
export const MAX_HEADING = 200;
export const MAX_BODY = 4000;

export const EMPTY_TEXT_SPEC = {
  heading: "",
  body: "",
  align: "left",
  size: "md",
  accent: "",
  // The card's own title is optional on a text block: a title band needs
  // only its heading, and a second line above it would say it twice.
  title: "",
  description: "",
  board_size: "medium",
  appearance: null,
  period: null,
  pinned_fields: [],
};

/** Why a text block cannot be added yet. */
export function text_spec_problems(spec, translate) {
  const problems = [];
  if (!String(spec.heading || "").trim() && !String(spec.body || "").trim()) problems.push(translate("DCS_DB_TEXT_NEED_WORDS"));
  return problems;
}

let sequence = 0;

/** The widget document of one text block. */
export function build_text_draft(form, spec) {
  sequence += 1;
  const text = {
    heading: String(spec.heading || "").trim().slice(0, MAX_HEADING),
    body: String(spec.body || "").replace(/\s+$/, "").slice(0, MAX_BODY),
    align: TEXT_ALIGNS.includes(spec.align) ? spec.align : "left",
    size: TEXT_SIZES.includes(spec.size) ? spec.size : "md",
  };
  if (/^#[0-9a-f]{6}$/i.test(String(spec.accent || "").trim())) text.accent = String(spec.accent).trim().toLowerCase();
  const widget = {
    id: `t_${form.form_group_id}_${Date.now()}_${sequence}`,
    form_group_id: form.form_group_id,
    title: String(spec.title || "").trim().slice(0, 120),
    description: String(spec.description || "").trim(),
    icon: null,
    chart_type: "text",
    metric: { aggregation: "count", field_id: null },
    group_by: null,
    split_by: null,
    pattern_by: null,
    legend_by: null,
    appearance: spec.appearance || null,
    text,
    x_field_id: null,
    y_field_id: null,
    size_field_id: null,
    filters: [],
    period: { preset: "all", from: null, to: null },
    sort: "value_desc",
    limit: 12,
    size: ["small", "medium", "large"].includes(spec.board_size) ? spec.board_size : "medium",
    position: 0,
  };
  return with_behavior([widget], { period: null, pinned_fields: [] });
}

/** A saved text block read back into the composer. */
export function text_widget_to_spec(widget) {
  const text = (widget && widget.text) || {};
  return {
    ...EMPTY_TEXT_SPEC,
    heading: text.heading || "",
    body: text.body || "",
    align: TEXT_ALIGNS.includes(text.align) ? text.align : "left",
    size: TEXT_SIZES.includes(text.size) ? text.size : "md",
    accent: text.accent || "",
    title: widget.title || "",
    description: widget.description || "",
    board_size: widget.size || "medium",
    appearance: widget.appearance || null,
    ...behavior_spec(widget),
  };
}
