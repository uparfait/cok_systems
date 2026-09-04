import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

const CHIP_STYLES = {
  approved: { color: "#4CAF50", labelKey: "DCS_APPROVAL_STATUS_APPROVED" },
  rejected: { color: "#E74C3C", labelKey: "DCS_APPROVAL_STATUS_REJECTED" },
  pending: { color: "#F39C12", labelKey: "DCS_APPROVAL_STATUS_WAITING" },
  skipped: { color: "#9E9E9E", labelKey: "DCS_APPROVAL_STATUS_SKIPPED" },
  scheduled: { color: "#056daa", labelKey: "DCS_APPROVAL_STATUS_SCHEDULED" },
};

/**
 * The label key of a record's approval state, or null when no approval was
 * ever requested or scheduled for it - used by the data tables, which
 * render the state as plain measurable text rather than a chip.
 */
export function approval_status_label_key(status) {
  const chip = CHIP_STYLES[status];
  return chip ? chip.labelKey : null;
}

/**
 * A small colored chip for an approval state, or a plain dash when no
 * approval was ever requested or scheduled - used in the approval dialogs
 * and the approver page.
 */
export default function DcsApprovalStatusChip({ status }) {
  const { translate } = useDcsLanguage();
  const chip = CHIP_STYLES[status];
  if (!chip) return <span style={{ color: "#9E9E9E" }}>-</span>;
  return (
    <span
      className="text-xs font-bold px-2 py-0.5 uppercase whitespace-nowrap"
      style={{ color: "#FFFFFF", backgroundColor: chip.color, fontFamily: "'Montserrat', sans-serif" }}
    >
      {translate(chip.labelKey)}
    </span>
  );
}
