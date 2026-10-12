import React from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import DcsButtonPrimary from "../../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../../components/DcsButtonOutline.jsx";
import SpiralLoader from "../../../event-managment/components/SpiralLoader.jsx";

const PRIMARY = "#056daa";

/**
 * What studio mode offers, and all it offers: SAVE CHANGES, DISCARD and
 * EXIT, in the bottom corner where the eye rests at the end of a gesture.
 *
 * Save writes the whole board - every widget and how it is arranged - in
 * one go. Discard puts the working copy back to what was last saved and
 * stays in the mode, so a bad afternoon costs nothing. Exit leaves, and
 * asks first when there is something still unsaved.
 */
export default function StudioToolbar({ dirty, saving, onSave, onDiscard }) {
  const { translate } = useDcsLanguage();
  return (
    <div
      className="dcs-selection-bar flex flex-wrap items-center justify-end gap-2 bg-white border-2 px-3 py-2"
      style={{ borderColor: PRIMARY, boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}
    >
      {saving ? (
        <SpiralLoader padded={false} size={20} />
      ) : (
        <>
          <DcsButtonOutline className="px-3 py-1.5" disabled={!dirty} onClick={onDiscard} style={{ minHeight: 34 }}>
            {translate("DCS_DB_STUDIO_DISCARD")}
          </DcsButtonOutline>
          <DcsButtonPrimary className="px-3 py-1.5" disabled={!dirty} onClick={onSave} style={{ minHeight: 34 }}>
            {translate("DCS_DB_STUDIO_SAVE")}
          </DcsButtonPrimary>
        </>
      )}
    </div>
  );
}
