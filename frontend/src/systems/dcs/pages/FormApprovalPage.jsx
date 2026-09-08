import React, { useState, useEffect, useRef, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { update_form, get_form_field_options, get_form_approvers } from "../services/formsService.js";
import { useLazyFieldResolvers } from "../hooks/useLazyFieldResolvers.js";
import ApprovalFlowSection from "../builder/ApprovalFlowSection.jsx";
import { validate_form_schema } from "../builder/validateSchema.js";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";

const PAGE_SIZE = 100;

export default function FormApprovalPage() {
  const { form_group_id, form, refreshForm } = useOutletContext();
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const [approval_config, setApprovalConfig] = useState(null);
  const [load_state, setLoadState] = useState({ status: "loading", loaded: 0, total: null });
  const [schema_errors, setSchemaErrors] = useState([]);
  const { resolveFullFieldOptions } = useLazyFieldResolvers("form", form_group_id, get_form_field_options);
  const [is_dirty, setIsDirty] = useState(false);
  const loaded_approvers_ref = useRef([]);
  const cancelled_ref = useRef(false);

  const load_approvers = useCallback(async () => {
    setLoadState((previous) => ({ status: "loading", loaded: loaded_approvers_ref.current.length, total: previous.total }));
    try {
      let enabled = false;
      let mode;
      let total = null;
      while (!cancelled_ref.current) {
        const offset = loaded_approvers_ref.current.length;
        const response = await get_form_approvers(form_group_id, offset, PAGE_SIZE);
        enabled = response.data.enabled;
        mode = response.data.mode;
        total = response.data.total;
        loaded_approvers_ref.current = loaded_approvers_ref.current.concat(response.data.approvers || []);
        setApprovalConfig({ enabled, mode, approvers: [...loaded_approvers_ref.current] });
        setLoadState({ status: "loading", loaded: loaded_approvers_ref.current.length, total });
        if (loaded_approvers_ref.current.length >= total || (response.data.approvers || []).length === 0) break;
      }
      if (cancelled_ref.current) return;
      setLoadState({ status: "loaded", loaded: loaded_approvers_ref.current.length, total });
    } catch (error) {
      if (cancelled_ref.current) return;
      setLoadState((previous) => ({ status: "failed", loaded: loaded_approvers_ref.current.length, total: previous.total }));
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form_group_id]);

  useEffect(() => {
    cancelled_ref.current = false;
    loaded_approvers_ref.current = [];
    setApprovalConfig(null);
    setIsDirty(false);
    load_approvers();
    return () => {
      cancelled_ref.current = true;
    };
  }, [form_group_id, load_approvers]);

  const handle_save_approvers = async (config) => {
    const frontend_check = validate_form_schema({ fields: form.schema.fields });
    if (!frontend_check.valid) {
      setSchemaErrors(frontend_check.errors);
      showError(translate("DCS_SCHEMA_ERROR_BANNER"));
      return;
    }
    try {
      const response = await update_form(form_group_id, form.form_name || "", { fields: form.schema.fields }, config);
      showSuccess(response.message || translate("DCS_APPROVAL_SAVED"));
      refreshForm();
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    }
  };

  const is_fully_loaded = load_state.status === "loaded";

  return (
    <div className="space-y-4 pb-16 w-full">
      <div className="bg-white border-2 p-4 sm:p-6 w-full" style={{ borderColor: "#E0E0E0" }}>
        {approval_config === null ? (
          <div className="flex flex-col items-center gap-3 py-8">
            {load_state.status === "loading" && <span className="dcs-inline-spinner" style={{ color: "#056daa" }} />}
            <p className="text-sm font-semibold" style={{ color: load_state.status === "failed" ? "#E74C3C" : "#056daa", fontFamily: "'Montserrat', sans-serif" }}>
              {load_state.status === "failed"
                ? translate("DCS_APPROVAL_LOAD_FAILED")
                : translate("DCS_APPROVAL_LOADING_APPROVERS", { loaded: 0, total: "?" })}
            </p>
            {load_state.status === "failed" && (
              <DcsButtonOutline style={{ width: "auto" }} onClick={load_approvers}>
                {translate("DCS_BTN_LOAD_MORE")}
              </DcsButtonOutline>
            )}
          </div>
        ) : (
          <>
            <div style={is_fully_loaded ? undefined : { pointerEvents: "none", opacity: 0.75 }}>
              <ApprovalFlowSection
                value={approval_config}
                onChange={setApprovalConfig}
                fields={form.schema.fields}
                onSave={handle_save_approvers}
                resolveFullFieldOptions={resolveFullFieldOptions}
                onDirtyChange={setIsDirty}
              />
            </div>

            {!is_fully_loaded && (
              <div className="flex flex-col items-center gap-2 pt-4 mt-4" style={{ borderTop: "1px solid #E0E0E0" }}>
                {load_state.status === "loading" && <span className="dcs-inline-spinner" style={{ color: "#056daa" }} />}
                <p className="text-sm font-semibold" style={{ color: load_state.status === "failed" ? "#E74C3C" : "#056daa", fontFamily: "'Montserrat', sans-serif" }}>
                  {load_state.status === "failed"
                    ? translate("DCS_APPROVAL_LOAD_FAILED")
                    : translate("DCS_APPROVAL_LOADING_APPROVERS", {
                        loaded: load_state.loaded,
                        total: load_state.total === null ? "?" : load_state.total,
                      })}
                </p>
                {load_state.total !== null && load_state.total > 0 && (
                  <div className="w-full" style={{ maxWidth: 360, height: 8, backgroundColor: "#E0E0E0" }}>
                    <div
                      style={{
                        height: 8,
                        width: `${Math.min(100, Math.round((load_state.loaded / Math.max(1, load_state.total)) * 100))}%`,
                        backgroundColor: "#056daa",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                )}
                {load_state.status === "failed" && (
                  <DcsButtonOutline style={{ width: "auto" }} onClick={load_approvers}>
                    {translate("DCS_BTN_LOAD_MORE")}
                  </DcsButtonOutline>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
