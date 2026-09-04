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
 * The data table's Approval column value: a small colored chip for a
 * record's approval state, or a plain dash when no approval was ever
 * requested or scheduled for it.
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
