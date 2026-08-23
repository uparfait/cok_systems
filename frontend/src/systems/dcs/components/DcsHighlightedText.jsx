import React from "react";

const HIGHLIGHT_COLOR = "#F5A623";

/**
 * Renders `text` plainly, except for the first case-insensitive occurrence
 * of `query`, which is wrapped in an orange-on-white mark - used by the
 * sidebar search so a matched project/form name reads as "selected"
 * instead of needing a separate results section to explain why it's shown.
 * An empty query (the normal, non-searching case) renders plain text.
 */
export default function DcsHighlightedText({ text, query }) {
  const safe_text = text || "";
  const trimmed_query = (query || "").trim();
  if (!trimmed_query) return <>{safe_text}</>;

  const match_index = safe_text.toLowerCase().indexOf(trimmed_query.toLowerCase());
  if (match_index === -1) return <>{safe_text}</>;

  const before = safe_text.slice(0, match_index);
  const match = safe_text.slice(match_index, match_index + trimmed_query.length);
  const after = safe_text.slice(match_index + trimmed_query.length);

  return (
    <>
      {before}
      <span style={{ backgroundColor: HIGHLIGHT_COLOR, color: "#FFFFFF", padding: "0 2px" }}>{match}</span>
      {after}
    </>
  );
}
