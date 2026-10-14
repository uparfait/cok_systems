import React, { useEffect, useRef, useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { useToast } from "../../../../core/contexts/ToastContext.tsx";
import { get_form_field_options } from "../../services/formsService.js";
import { update_follow_up, follow_up_public_url } from "../../services/followUpService.js";
import { useLazyFieldResolvers } from "../../hooks/useLazyFieldResolvers.js";
import { validate_form_schema } from "../../builder/validateSchema.js";
import DcFormBuilderSection from "../../builder/DcFormBuilderSection.jsx";
import RespondentGateToggle from "../../builder/RespondentGateToggle.jsx";
import DcsFormNameField from "../DcsFormNameField.jsx";
import DcsButtonOutline from "../DcsButtonOutline.jsx";
import FollowUpVersions from "./FollowUpVersions.jsx";

const FONT = "'Montserrat', sans-serif";
const BORDER = "#E0E0E0";

export default function FollowUpSettings({ formGroupId, followUp, versions, canEdit, recordCount, onChanged }) {
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const [fields, setFields] = useState(followUp.schema.fields);
  const [form_name, setFormName] = useState(followUp.form_name || "");
  const [ask_respondent, setAskRespondent] = useState(followUp.ask_respondent !== false);
  const [publishing, setPublishing] = useState(false);
  const [schema_errors, setSchemaErrors] = useState([]);
  const loaded_id_ref = useRef(followUp._id);
  const { resolveFieldOptions, resolveFullFieldOptions } = useLazyFieldResolvers("form", formGroupId, get_form_field_options);

  useEffect(() => {
    if (followUp._id === loaded_id_ref.current) return;
    loaded_id_ref.current = followUp._id;
    setFields(followUp.schema.fields);
    setFormName(followUp.form_name || "");
    setAskRespondent(followUp.ask_respondent !== false);
  }, [followUp]);

  const public_link = follow_up_public_url(followUp.follow_up_group_id);

  const copy_link = () => {
    window.navigator.clipboard.writeText(public_link);
    showSuccess(translate("DCS_TOAST_LINK_COPIED"));
  };

  const handle_fields_change = (next_fields) => {
    setSchemaErrors([]);
    setFields(next_fields);
  };

  const handle_publish = async (schema) => {
    const check = validate_form_schema(schema);
    if (!check.valid) {
      setSchemaErrors(check.errors);
      showError(translate("DCS_SCHEMA_ERROR_BANNER"));
      return false;
    }
    setPublishing(true);
    try {
      const response = await update_follow_up(formGroupId, form_name, schema, ask_respondent);
      setSchemaErrors([]);
      showSuccess(response.message || translate("DCS_FU_SAVED_TOAST"));
      onChanged();
      return true;
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
      setSchemaErrors(Array.isArray(error.errors) ? error.errors : []);
      return false;
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-4 pb-16 px-1 sm:px-2">
      <div className="bg-white border-2 p-4 sm:p-6 flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: BORDER }}>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase" style={{ color: "#9E9E9E", fontFamily: FONT }}>
            {translate("DCS_FU_PUBLIC_LINK_LABEL")}
          </p>
          <p className="truncate text-sm" style={{ color: "#056daa" }} title={public_link}>
            {public_link}
          </p>
        </div>
        <DcsButtonOutline onClick={copy_link}>{translate("DCS_FORM_COPY_LINK")}</DcsButtonOutline>
      </div>

      {canEdit ? (
        <div className="bg-white border-2 p-4 sm:p-6" style={{ borderColor: BORDER }}>
          <p className="text-xs mb-3" style={{ color: "#9E9E9E", fontFamily: FONT }}>
            {translate("DCS_FU_SETTINGS_HINT")}
          </p>
          <RespondentGateToggle value={ask_respondent} onChange={setAskRespondent} />
          <DcsFormNameField value={form_name} onChange={setFormName} />
          <DcFormBuilderSection
            fields={fields}
            onFieldsChange={handle_fields_change}
            onPublish={handle_publish}
            publishing={publishing}
            schemaErrors={schema_errors}
            resolveFieldOptions={resolveFieldOptions}
            resolveFullFieldOptions={resolveFullFieldOptions}
            trackingScopeId={`follow-up:${followUp.follow_up_group_id}`}
          />
        </div>
      ) : (
        <div className="bg-white border-2 p-4 sm:p-6 space-y-3" style={{ borderColor: BORDER }}>
          <p className="text-xs" style={{ color: "#9E9E9E", fontFamily: FONT }}>
            {translate("DCS_FU_READ_ONLY")}
          </p>
          <div>
            <p className="cok-auth-label">{translate("DCS_FIELD_FORM_NAME")}</p>
            <p className="text-sm font-semibold" style={{ color: "#333333", fontFamily: FONT }}>
              {followUp.form_name || ""}
            </p>
          </div>
          <div>
            <p className="cok-auth-label">{translate("DCS_RESPONDENT_GATE_TITLE")}</p>
            <p className="text-xs" style={{ color: "#555555", fontFamily: FONT }}>
              {translate(followUp.ask_respondent !== false ? "DCS_RESPONDENT_GATE_ON_HINT" : "DCS_RESPONDENT_GATE_OFF_HINT")}
            </p>
          </div>
        </div>
      )}

      <FollowUpVersions formGroupId={formGroupId} versions={versions} canEdit={canEdit} recordCount={recordCount} onChanged={onChanged} />
    </div>
  );
}
