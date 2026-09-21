import React, { useState } from "react";
import { read_respondent } from "../offline/respondentStore.js";
import DcsRespondentGate from "../components/DcsRespondentGate.jsx";
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
 * Lets a form author test the exact page a respondent will see - same
 * background, same card, same submit control, same error/success
 * messaging (DcsSubmitControl, shared verbatim with PublicFormPage) - so
 * every validation rule can be verified end to end before publishing.
 * Deliberately carries no branded header bar or separate footer chrome:
 * anything that made this screen look like a distinct "tool" instead of
 * the public form itself defeats the point of a rehearsal. Close and
 * Publish are the only additions, kept as minimal, unobtrusive controls
 * layered on top of - never a different design around - the same page.
 * Submitting here only ever runs the validation: it never calls the
 * backend and never saves anything, it is a rehearsal. onPublish is
 * optional - omit it (e.g. reviewing a saved template, which has nothing
 * of its own to publish) and only the rehearsal itself and a Close button
 * show, with no publish action at all.
 */
export default function ReviewOverlay({ schema, onClose, onPublish, publishing, uploadingFiles, uploadPercent, publishLabelKey, publishBlockedKey, resolveFieldOptions }) {
  const { translate, language } = useDcsLanguage();
  const { showSuccess } = useToast();
  const [values, setValues] = useState({});
  const [field_errors, setFieldErrors] = useState({});
  const [field_valid_messages, setFieldValidMessages] = useState({});
  const [test_submitting, setTestSubmitting] = useState(false);
  const [submit_state, setSubmitState] = useState("idle");
  const [reveal_all_errors, setRevealAllErrors] = useState(false);
  // The rehearsal asks who is filling in, exactly as the public page does.
  const [respondent, setRespondent] = useState(null);
  const [saved_respondent] = useState(() => read_respondent());

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
        setRevealAllErrors(true);
        setSubmitState("error");
      }
    } finally {
      setTestSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] overflow-y-auto p-0 min-[760px]:px-6 min-[760px]:pt-[52px] min-[760px]:pb-6 flex flex-col items-center" style={{ backgroundColor: "#F7F9FB" }}>
      <div className="fixed" style={{ top: 12, right: 12, zIndex: 10001 }}>
        <DcsButtonOutlineReverse onClick={onClose} disabled={publishing}>
          {translate("DCS_BTN_CLOSE")}
        </DcsButtonOutlineReverse>
      </div>

      {!respondent && <DcsRespondentGate saved={saved_respondent} onConfirm={setRespondent} />}

      {/* The same card as PublicFormPage: 5 px rounded border in the
          system blue at 35%, edge to edge on phones. */}
      <div
        className="w-full min-[760px]:max-w-[700px] bg-white p-4 border-0 min-[760px]:border-[5px] min-[760px]:rounded-[5px] mt-0 min-[760px]:mt-3 mb-0 min-[760px]:mb-6 grow min-[760px]:grow-0"
        style={{ borderColor: "rgba(5,109,170,0.35)" }}
      >
        {respondent && (
          <p className="text-xs mb-3 truncate" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
            {translate("DCS_RESPONDENT_FILLING_AS", { name: respondent.name })}
          </p>
        )}
        <RendererEngine
          schema={schema}
          mode="renderer"
          values={values}
          onValueChange={handle_value_change}
          fieldErrors={field_errors}
          fieldValidMessages={field_valid_messages}
          revealAllErrors={reveal_all_errors}
          resolveFieldOptions={resolveFieldOptions}
        />

        <DcsSubmitControl
          submitting={test_submitting}
          submitState={submit_state}
          onSubmit={handle_test_submit}
          onIdle={() => setSubmitState("idle")}
        />

        {/* publishBlockedKey turns this overlay into what it already is
            for a reviewer - a rehearsal - and says why in the place the
            publish button would have been, rather than leaving a button
            that only ever refuses. */}
        {onPublish && publishBlockedKey && (
          <div className="w-full mt-3 p-3" style={{ border: "1px solid #F39C12", backgroundColor: "rgba(243,156,18,0.12)" }}>
            <p className="text-xs" style={{ color: "#B9770E", fontFamily: "'Montserrat', sans-serif" }}>
              {translate(publishBlockedKey)}
            </p>
          </div>
        )}

        {onPublish && !publishBlockedKey && (
          <div className="w-full mt-3">
            {publishing ? (
              <SpiralLoader />
            ) : (
              <DcsButtonPrimary className="w-full" onClick={onPublish} disabled={publishing || uploadingFiles}>
                {uploadingFiles ? translate("DCS_DESIGN_UPLOADING_PERCENT", { percent: uploadPercent }) : translate(publishLabelKey || "DCS_BTN_PUBLISH")}
              </DcsButtonPrimary>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
