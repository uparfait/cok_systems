import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { transfer_form_ownership } from "../services/formsService.js";
import DcsOwnershipTransfer from "../components/DcsOwnershipTransfer.jsx";

/**
 * Handing a form over to another employee, on its own page rather than
 * buried under the field settings it has nothing to do with. The header
 * link is always there, so a viewer who may not transfer this form is told
 * as much here instead of finding a link that leads nowhere.
 */
export default function FormOwnershipPage() {
  const { form_group_id, form, refreshForm } = useOutletContext();
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const [transferring, setTransferring] = useState(false);

  const handle_transfer = async (user) => {
    setTransferring(true);
    try {
      await transfer_form_ownership(form_group_id, user.user_id);
      showSuccess(translate("DCS_TOAST_OWNERSHIP_TRANSFERRED", { name: user.full_name || user.email }));
      refreshForm();
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="space-y-4 pb-16">
      <div className="bg-white border-2 p-4 sm:p-6" style={{ borderColor: "#E0E0E0" }}>
        {form.viewer_can_transfer === true ? (
          <DcsOwnershipTransfer ownerName={form.owner_name} onTransfer={handle_transfer} transferring={transferring} />
        ) : (
          <>
            <p className="text-xs font-semibold uppercase mb-1" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.5px" }}>
              {translate("DCS_TRANSFER_CURRENT_OWNER")}
            </p>
            <p className="text-sm mb-3" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
              {form.owner_name || "-"}
            </p>
            <p className="text-xs" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
              {translate("DCS_OWNERSHIP_TRANSFER_NOT_ALLOWED")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
