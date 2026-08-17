import React, { useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { validate_submission_client_side } from "../jsonlogic/validateSubmission.js";
import { compute_derived_values } from "./formEngine.js";
import RendererEngine from "./RendererEngine.jsx";
import DcsSubmitControl from "../components/DcsSubmitControl.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutlineReverse from "../components/DcsButtonOutlineReverse.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

/**
 * Full-width overlay that lets a form author test the exact same page a
 * respondent will see - same background, same card, same submit control,
 * same error/success messaging (DcsSubmitControl, shared verbatim with
 * PublicFormPage) - so every validation rule can be verified end to end
 * before publishing. Submitting here only ever runs the validation: it
 * never calls the backend and never saves anything, it is a rehearsal.
 * Publishing the schema itself is a separate action in the footer.
 */
export default function ReviewOverlay({ schema, onClose, onPublish, publishing }) {
  const { translate, language } = useDcsLanguage();
  const { showSuccess } = useToast();
  const [values, setValues] = useState({});
  const [field_errors, setFieldErrors] = useState({});
  const [field_valid_messages, setFieldValidMessages] = useState({});
  const [test_submitting, setTestSubmitting] = useState(false);
  const [submit_state, setSubmitState] = useState("idle");

  const handle_value_change = (field_id, value) => {
    setSubmitState("idle");
    setValues((previous_values) => {
      const merged_values = Object.assign({}, previous_values, { [field_id]: value });
      const resolved_values = compute_derived_values(schema, merged_values);
      const validation_result = validate_submission_client_side(schema, resolved_values, language, translate);
      setFieldErrors(validation_result.field_errors);
      setFieldValidMessages(validation_result.field_valid_messages);
      return resolved_values;
    });
  };

  const handle_test_submit = async () => {
    setTestSubmitting(true);
    try {
      const resolved_values = compute_derived_values(schema, values);
      const validation_result = validate_submission_client_side(schema, resolved_values, language, translate);
      setFieldErrors(validation_result.field_errors);
      setFieldValidMessages(validation_result.field_valid_messages);
      // Never calls the backend and never saves anything - this only ever
      // verifies the conditions, as a live rehearsal of the real form.
      if (validation_result.valid) {
        setSubmitState("success");
        showSuccess(translate("DCS_PUBLIC_DATA_RECORDED"));
      } else {
        setSubmitState("error");
      }
    } finally {
      setTestSubmitting(false);
    }
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

      <div className="flex-1 overflow-y-auto min-h-0 p-0 min-[650px]:p-6 flex flex-col items-center" style={{ backgroundColor: "#F7F9FB" }}>
        <div className="w-full min-[650px]:max-w-[650px] bg-white p-4 min-[650px]:p-6 border-0 min-[650px]:border-2 min-[650px]:border-[#056daa]">
          <RendererEngine
            schema={schema}
            mode="renderer"
            values={values}
            onValueChange={handle_value_change}
            fieldErrors={field_errors}
            fieldValidMessages={field_valid_messages}
          />

          <DcsSubmitControl
            submitting={test_submitting}
            submitState={submit_state}
            onSubmit={handle_test_submit}
            onIdle={() => setSubmitState("idle")}
          />
        </div>
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
