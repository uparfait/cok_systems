import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { get_template, get_template_field_options, update_template, delete_template } from "../services/templatesService.js";
import { useLazyFieldResolvers } from "../hooks/useLazyFieldResolvers.js";
import DcFormBuilderSection from "../builder/DcFormBuilderSection.jsx";
import DcsTemplateNameField from "../components/DcsTemplateNameField.jsx";
import DcsButtonOutlineDanger from "../components/DcsButtonOutlineDanger.jsx";
import DcsConfirmDialog from "../components/DcsConfirmDialog.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

/**
 * Editing an existing template - the exact same builder used for a form,
 * pre-filled with the template's current name, description and fields.
 * Deleting it here never touches any form that already inserted it
 * earlier, since that form kept its own copy of the fields.
 * System templates cannot be deleted.
 */
export default function TemplateSettingsPage() {
  const { template_id } = useParams();
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  const [load_state, setLoadState] = useState("loading");
  const [fields, setFields] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [is_system_template, setIsSystemTemplate] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [is_confirming_delete, setIsConfirmingDelete] = useState(false);
  const [schema_errors, setSchemaErrors] = useState([]);
  const { resolveFieldOptions, resolveFullFieldOptions } = useLazyFieldResolvers("template", template_id, get_template_field_options);

  useEffect(() => {
    let is_mounted = true;
    get_template(template_id)
      .then((response) => {
        if (!is_mounted) return;
        setFields(response.data.fields || []);
        setName(response.data.name || "");
        setDescription(response.data.description || "");
        setIsSystemTemplate(!!response.data.is_system_template);
        setLoadState("ready");
      })
      .catch(() => {
        if (is_mounted) setLoadState("not_found");
      });
    return () => {
      is_mounted = false;
    };
  }, [template_id]);

  const handle_fields_change = (next_fields) => {
    setSchemaErrors([]);
    setFields(next_fields);
  };

  const handle_publish = async (schema) => {
    setPublishing(true);
    try {
      await update_template(template_id, name, description, schema.fields);
      showSuccess(translate("DCS_TOAST_TEMPLATE_SAVED"));
      return true;
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
      setSchemaErrors(Array.isArray(error.errors) ? error.errors : []);
      return false;
    } finally {
      setPublishing(false);
    }
  };

  const handle_delete = async () => {
    setDeleting(true);
    try {
      await delete_template(template_id);
      showSuccess(translate("DCS_TOAST_TEMPLATE_DELETED"));
      navigate("/dcs-system/templates");
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setDeleting(false);
      setIsConfirmingDelete(false);
    }
  };

  if (load_state === "loading") return <SpiralLoader />;
  if (load_state === "not_found") {
    return (
      <p className="text-sm py-16 text-center" style={{ color: "#9E9E9E" }}>
        {translate("DCS_TEMPLATE_NOT_FOUND")}
      </p>
    );
  }

  return (
    <div className="w-full min-[760px]:w-[80vw] mx-auto pb-16 space-y-4">
      <div className="bg-white border-2 p-4 sm:p-6 flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: "#E0E0E0" }}>
        <div className="flex items-center gap-3">
          <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 18, color: "#333333" }}>
            {translate("DCS_SECTION_EDIT_TEMPLATE")}
          </h2>
          {is_system_template && (
            <span className="px-2 py-1 text-xs font-medium rounded-none" style={{ backgroundColor: "#E3F2FD", color: "#1565C0" }}>
              System Template
            </span>
          )}
        </div>
        {!is_system_template && (
          <DcsButtonOutlineDanger onClick={() => setIsConfirmingDelete(true)}>{translate("DCS_BTN_DELETE_TEMPLATE")}</DcsButtonOutlineDanger>
        )}
      </div>

      <div className="bg-white border-2 p-4 sm:p-6" style={{ borderColor: "#E0E0E0" }}>
        <DcsTemplateNameField name={name} onNameChange={setName} description={description} onDescriptionChange={setDescription} />
        <DcFormBuilderSection
          fields={fields}
          onFieldsChange={handle_fields_change}
          onPublish={handle_publish}
          publishing={publishing}
          schemaErrors={schema_errors}
          publishLabelKey="DCS_BTN_SAVE_TEMPLATE"
          resolveFieldOptions={resolveFieldOptions}
          resolveFullFieldOptions={resolveFullFieldOptions}
        />
      </div>

      {is_confirming_delete && (
        <DcsConfirmDialog
          titleKey="DCS_TEMPLATE_DELETE_TITLE"
          messageKey="DCS_TEMPLATE_DELETE_WARNING"
          confirming={deleting}
          onConfirm={handle_delete}
          onCancel={() => setIsConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
