import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { DcsLanguageProvider, useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { get_public_form_field_options } from "../services/formsService.js";
import { get_public_follow_up_record, update_public_follow_up_record, public_follow_up_upload_endpoint } from "../services/followUpService.js";
import { useLazyFieldResolvers } from "../hooks/useLazyFieldResolvers.js";
import { compute_derived_values } from "../renderer/formEngine.js";
import { validate_submission_client_side } from "../jsonlogic/validateSubmission.js";
import { MediaUploadProvider } from "../renderer/MediaUploadContext.jsx";
import { format_when } from "../tracking/trackingConfig.js";
import RendererEngine from "../renderer/RendererEngine.jsx";
import DcsFormLoadingSpinner from "../components/DcsFormLoadingSpinner.jsx";
import DcsEmptyState from "../components/DcsEmptyState.jsx";
import DcsErrorBoundary from "../components/DcsErrorBoundary.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

const FONT = "'Montserrat', sans-serif";

function EditFollowUpRecordPageContent() {
  const { id } = useParams();
  const { translate, language } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState(null);
  const [record, setRecord] = useState(null);
  const [load_state, setLoadState] = useState("loading");
  const [values, setValues] = useState({});
  const [field_errors, setFieldErrors] = useState({});
  const [field_valid_messages, setFieldValidMessages] = useState({});
  const [reveal_all_errors, setRevealAllErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  const source_form_group_id = form ? form.source_form_group_id || (record && record.source_form_group_id) || "" : "";
  const follow_up_group_id = form ? form.follow_up_group_id || (record && record.follow_up_group_id) || "" : "";
  const { resolveFieldOptions } = useLazyFieldResolvers("public_form", source_form_group_id, get_public_form_field_options);

  useEffect(() => {
    let is_mounted = true;
    setLoadState("loading");
    get_public_follow_up_record(id)
      .then((response) => {
        if (!is_mounted) return;
        const data = response.data || {};
        setForm(data.form);
        setRecord(data.record);
        setValues(compute_derived_values(data.form.schema, data.record.data || {}));
        setLoadState("ready");
      })
      .catch(() => is_mounted && setLoadState("not_found"));
    return () => {
      is_mounted = false;
    };
  }, [id]);

  const handle_value_change = (field_id, next_value) => {
    setValues((previous_values) => {
      const merged_values = Object.assign({}, previous_values, { [field_id]: next_value });
      const resolved_values = compute_derived_values(form.schema, merged_values);
      const validation_result = validate_submission_client_side(form.schema, resolved_values, language, translate);
      setFieldErrors(validation_result.field_errors);
      setFieldValidMessages(validation_result.field_valid_messages);
      return validation_result.resolved_data;
    });
  };

  const leave = () => {
    if (window.opener !== null || window.history.length <= 1) {
      window.close();
      return;
    }
    navigate(-1);
  };

  const handle_save = async () => {
    const resolved = compute_derived_values(form.schema, values);
    const validation_result = validate_submission_client_side(form.schema, resolved, language, translate);
    setFieldErrors(validation_result.field_errors);
    setFieldValidMessages(validation_result.field_valid_messages);
    if (!validation_result.valid) {
      setRevealAllErrors(true);
      return;
    }

    setSaving(true);
    try {
      const response = await update_public_follow_up_record(id, { data: validation_result.resolved_data, respondent: record.respondent || null });
      const saved = response.data || {};
      const next_record = Object.assign({}, record, saved, { respondent: record.respondent || null });
      setRecord(next_record);
      setValues(compute_derived_values(form.schema, next_record.data || {}));
      setFieldErrors({});
      setRevealAllErrors(false);
      showSuccess(response.message || translate("DCS_EDIT_RECORD_SAVED"));
    } catch (error) {
      if (error && error.field_errors) {
        setFieldErrors(error.field_errors);
        setRevealAllErrors(true);
      }
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setSaving(false);
    }
  };

  if (load_state === "loading") return <DcsFormLoadingSpinner />;
  if (load_state === "not_found") return <DcsEmptyState messageKey="DCS_EDIT_RECORD_NOT_FOUND" />;

  return (
    <>
      <Helmet>
        <title>{`${translate("DCS_FU_EDIT_TITLE")} - ${form.form_name || ""}`}</title>
      </Helmet>

      <div
        className="min-h-screen p-0 min-[760px]:px-6 pt-[env(safe-area-inset-top,0px)] min-[760px]:pt-6 pb-[env(safe-area-inset-bottom,0px)] min-[760px]:pb-8 flex flex-col items-center"
        style={{ backgroundColor: "#F7F9FB" }}
      >
        <div
          className="w-full min-[760px]:max-w-[700px] bg-white p-4 border-0 min-[760px]:border-[5px] min-[760px]:rounded-[5px] grow min-[760px]:grow-0"
          style={{ borderColor: "rgba(5,109,170,0.35)" }}
        >
          <div className="mb-4 pb-3" style={{ borderBottom: "1px solid #E0E0E0" }}>
            <p className="text-[11px] font-bold uppercase" style={{ color: "#9E9E9E", fontFamily: FONT, letterSpacing: "0.6px" }}>
              {translate("DCS_FU_EDIT_TITLE")}
            </p>
            <p className="text-lg font-bold break-words" style={{ color: "#333333", fontFamily: FONT }}>
              {form.form_name}
            </p>
            <p className="text-xs" style={{ color: "#9E9E9E", fontFamily: FONT }}>
              {record.submitted_at ? format_when(record.submitted_at) : ""}
              {record.updated_at ? ` - ${translate("DCS_TRACKING_UPDATED_AT", { when: format_when(record.updated_at) })}` : ""}
            </p>
            <p className="text-xs mt-1" style={{ color: "#9E9E9E", fontFamily: FONT }}>
              {translate("DCS_FU_SOURCE_RECORD")}: {record.source_submission_id ? String(record.source_submission_id) : translate("DCS_FU_SOURCE_NONE")}
            </p>
          </div>

          <div style={saving ? { pointerEvents: "none", opacity: 0.6 } : undefined}>
            <MediaUploadProvider formGroupId={source_form_group_id} version={form.version} isOnline keepFiles uploadEndpoint={public_follow_up_upload_endpoint(follow_up_group_id)}>
              <RendererEngine
                schema={form.schema}
                mode="renderer"
                values={values}
                onValueChange={handle_value_change}
                fieldErrors={field_errors}
                fieldValidMessages={field_valid_messages}
                revealAllErrors={reveal_all_errors}
                resolveFieldOptions={resolveFieldOptions}
              />
            </MediaUploadProvider>
          </div>

          <div className="dcs-form-actions mt-5">
            {saving ? (
              <SpiralLoader />
            ) : (
              <>
                <DcsButtonOutline onClick={leave}>{translate("DCS_BTN_CANCEL")}</DcsButtonOutline>
                <DcsButtonPrimary onClick={handle_save}>{translate("DCS_EDIT_RECORD_SAVE")}</DcsButtonPrimary>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function EditFollowUpRecordPage() {
  return (
    <DcsErrorBoundary>
      <DcsLanguageProvider>
        <EditFollowUpRecordPageContent />
      </DcsLanguageProvider>
    </DcsErrorBoundary>
  );
}
