import React, { useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { validate_submission_client_side } from "../jsonlogic/validateSubmission.js";
import RendererEngine from "./RendererEngine.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutlineReverse from "../components/DcsButtonOutlineReverse.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

/**
 * Full-width, scrollable overlay that lets a form author test the exact
 * same renderer citizens will use - including live validation, so
 * mandatory responses and every validation rule can be checked before
 * publishing - then publish it.
 */
export default function ReviewOverlay({ schema, onClose, onPublish, publishing }) {
  const { translate, language } = useDcsLanguage();
  const [preview_values, setPreviewValues] = useState({});
  const [field_errors, setFieldErrors] = useState({});
  const [field_valid_messages, setFieldValidMessages] = useState({});

  const handle_value_change = (field_id, value) => {
    setPreviewValues((previous_values) => {
      const merged_values = Object.assign({}, previous_values, { [field_id]: value });
      const validation_result = validate_submission_client_side(schema, merged_values, language, translate);
      setFieldErrors(validation_result.field_errors);
      setFieldValidMessages(validation_result.field_valid_messages);
      return merged_values;
    });
  };

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col bg-white">
      <div className="cok-bg-primary px-4 py-3 flex items-center justify-between flex-shrink-0">
        <span className="text-white font-semibold uppercase tracking-wide" style={{ fontFamily: "'Montserrat', sans-serif" }}>
          {translate("DCS_REVIEW_TITLE")}
        </span>
        <DcsButtonOutlineReverse onClick={onClose} disabled={publishing}>
          {translate("DCS_BTN_CLOSE")}
        </DcsButtonOutlineReverse>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center">
        <RendererEngine
          schema={schema}
          mode="renderer"
          values={preview_values}
          onValueChange={handle_value_change}
          fieldErrors={field_errors}
          fieldValidMessages={field_valid_messages}
        />
      </div>

      <div className="p-4 sm:p-6 pt-3 border-t flex-shrink-0" style={{ borderColor: "#E0E0E0" }}>
        {publishing ? (
          <SpiralLoader />
        ) : (
          <DcsButtonPrimary className="w-full" onClick={onPublish} disabled={publishing}>
            {translate("DCS_BTN_PUBLISH")}
          </DcsButtonPrimary>
        )}
      </div>
    </div>
  );
}
