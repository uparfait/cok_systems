import React from "react";
import { useParams } from "react-router-dom";
import DcsWorkspaceShell from "../components/DcsWorkspaceShell.jsx";
import DcsExportDialog from "../components/DcsExportDialog.jsx";

/**
 * Downloads: taking a form's responses away as a spreadsheet. It has a
 * page of its own rather than a dialog over the table, because an export
 * of any size runs for a while and the person starting it should be able
 * to watch it finish somewhere that belongs to it.
 */
export default function FormDownloadsPage() {
  const { project_id, form_group_id } = useParams();

  return (
    <DcsWorkspaceShell projectId={project_id} formGroupId={form_group_id} titleKey="DCS_WS_DOWNLOADS">
      <div className="px-1 sm:px-2 max-w-xl mx-auto">
        <DcsExportDialog asPage form_group_id={form_group_id} />
      </div>
    </DcsWorkspaceShell>
  );
}
