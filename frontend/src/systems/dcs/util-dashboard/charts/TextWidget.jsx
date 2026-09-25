import React from "react";
import { build_palette } from "../appearance.js";
import { substitute_variables, has_text_variables } from "../textVariables.js";

/**
 * A TEXT block: words on the board. A title band across a section, an
 * observation under a chart, a recommendation at the foot of a page - the
 * things a printed report carries between its figures.
 *
 * It reads no data. What it shows is its heading and its body, set the
 * way the author asked (left, centred or right; small, medium or large)
 * and painted from the widget's own colours, so a band on a dark section
 * is white on blue without any more saying so. The body is written in a
 * light markup: a blank line starts a new paragraph, **these words** are
 * bold, and ==these words== take the accent colour - the number colour of
 * the widget unless the block names one of its own.
 *
 * A body may also carry LIVE FIGURES - {{count}}, {{sum(field)}},
 * {{share(field = value)}} and the rest (see textVariables.js) - which the
 * server computes under the board's filters and date and hands back in
 * data.values; until they land each reads "...".
 */

const SIZES = {
  sm: { heading: 12, body: 12 },
  md: { heading: 14, body: 13 },
  lg: { heading: 19, body: 14 },
};

// The two marks the body understands, longest match first so a bold
// phrase that holds a highlight is read as one thing rather than three.
const MARKS = /(\*\*[^*]+?\*\*|==[^=]+?==)/g;

/** One paragraph's text as React nodes: bold and highlighted spans, line breaks kept. */
export function render_marked(text, accent, key_prefix) {
  const nodes = [];
  String(text || "")
    .split("\n")
    .forEach((line, line_index) => {
      if (line_index > 0) nodes.push(<br key={`${key_prefix}-br-${line_index}`} />);
      line.split(MARKS).forEach((part, part_index) => {
        if (!part) return;
        const key = `${key_prefix}-${line_index}-${part_index}`;
        if (part.startsWith("**") && part.endsWith("**")) nodes.push(<b key={key}>{part.slice(2, -2)}</b>);
        else if (part.startsWith("==") && part.endsWith("==")) nodes.push(<span key={key} style={{ color: accent, fontWeight: 600 }}>{part.slice(2, -2)}</span>);
        else nodes.push(<React.Fragment key={key}>{part}</React.Fragment>);
      });
    });
  return nodes;
}

/** The body split into its paragraphs: a blank line between two runs of text. */
export const paragraphs_of = (body) =>
  String(body || "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

export default function TextWidget({ widget, palette, data }) {
  const colors = palette || build_palette(widget && widget.appearance);
  const text = (widget && widget.text) || {};
  const live = has_text_variables(widget);
  const body = live ? substitute_variables(text.body, data && data.values ? data.values : null) : text.body;
  const size = SIZES[text.size] || SIZES.md;
  const accent = text.accent || colors.number;
  const align = ["left", "center", "right"].includes(text.align) ? text.align : "left";
  const paragraphs = paragraphs_of(body);
  return (
    <div className="dcs-text-widget" style={{ textAlign: align, color: colors.text }}>
      {text.heading ? (
        <p className="dcs-text-heading" style={{ fontSize: size.heading, color: colors.text }}>
          {text.heading}
        </p>
      ) : null}
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="dcs-text-paragraph" style={{ fontSize: size.body }}>
          {render_marked(paragraph, accent, `p${index}`)}
        </p>
      ))}
    </div>
  );
}
