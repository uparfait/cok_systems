import React from "react";
import GeneratedWidgetsReview from "./GeneratedWidgetsReview.jsx";
import DashboardBuilder from "./builder/DashboardBuilder.jsx";
import DashboardCodeOverlay from "./DashboardCodeOverlay.jsx";

/**
 * The three full-screen ways a board is AUTHORED, kept together and away
 * from the page that shows it: the review of a freshly generated set, the
 * builder, and the paste-a-specification overlay. Each is closed, none of
 * them is open, or exactly one is - and all three end the same way, by
 * handing back the widgets and filters the board should now have.
 *
 * `reconfigure` is one widget already on the board, reopened in the
 * builder to be changed rather than a new one added; the builder then
 * saves it back in place under its own id. `intoCanvas` is the opposite:
 * whatever is built lands INSIDE that canvas instead of on the board.
 */
export default function BoardAuthoringOverlays({
  form,
  widgets,
  filters,
  reviewWidgets,
  reviewFocus,
  builderTab,
  reconfigure,
  intoCanvas,
  codeOpen,
  onCloseReview,
  onCloseBuilder,
  onCloseCode,
  onCommit,
  onAutoGenerate,
}) {
  return (
    <>
      {reviewWidgets !== null && (
        <GeneratedWidgetsReview form={form} initialWidgets={reviewWidgets} focusIds={reviewFocus} onOpenDashboard={onCloseReview} onClose={onCloseReview} onWidgetsChange={onCommit} />
      )}
      {builderTab !== null && (
        <DashboardBuilder
          form={form}
          existingWidgets={widgets}
          existingFilters={filters}
          initialTab={builderTab}
          reconfigure={reconfigure}
          intoCanvas={intoCanvas}
          onClose={onCloseBuilder}
          onSaved={(final_widgets, final_filters) => {
            onCloseBuilder();
            onCommit(final_widgets, final_filters);
          }}
          onAutoGenerate={onAutoGenerate}
        />
      )}
      {codeOpen && (
        <DashboardCodeOverlay
          form={form}
          widgets={widgets}
          filters={filters}
          onClose={onCloseCode}
          onSaved={(final_widgets, final_filters) => {
            onCloseCode();
            onCommit(final_widgets, final_filters);
          }}
        />
      )}
    </>
  );
}
