import React from "react";
import DashboardNameDialog from "./DashboardNameDialog.jsx";
import ShareLinksDialog from "./share/ShareLinksDialog.jsx";
import ScreenshotStudio from "./screenshot/ScreenshotStudio.jsx";
import RecordsOverlay from "./records/RecordsOverlay.jsx";
import { get_widget_records, export_widget_records } from "./dashboardService.js";

/**
 * The overlays a board opens over ITSELF, as opposed to the ones that
 * author it (see BoardAuthoringOverlays): the share-link dialog, the table
 * of records behind a widget, the screenshot studio, and the box that
 * names a new dashboard. None of them changes what the board holds.
 *
 * The records table asks for exactly what the board is showing - the same
 * period and the same filters - narrowed to whatever was clicked, so the
 * rows behind a bar really are the rows that bar was drawn from.
 */
export default function BoardViewOverlays({ shareOpen, share, records, view, shot, shotProps, naming, namingProps, onCloseShare, onCloseRecords, onCloseShot, onCancelNaming }) {
  const request = (open, page) => ({ widget: open.widget, period: view.period, filters: view.filters, pick: open.pick, language: view.language, page, limit: 20 });
  return (
    <>
      {shareOpen && <ShareLinksDialog {...share} onClose={onCloseShare} />}
      {records && (
        <RecordsOverlay
          title={records.widget.title}
          subtitle={view.board_name}
          schema={view.schema}
          fetchPage={(page) => get_widget_records(view.form_group_id, request(records, page))}
          exportRecords={(on_progress) => export_widget_records(view.form_group_id, { ...request(records), title: records.widget.title }, on_progress)}
          onClose={onCloseRecords}
        />
      )}
      {shot && <ScreenshotStudio {...shotProps} onClose={onCloseShot} />}
      {naming && <DashboardNameDialog {...namingProps} onCancel={onCancelNaming} />}
    </>
  );
}
