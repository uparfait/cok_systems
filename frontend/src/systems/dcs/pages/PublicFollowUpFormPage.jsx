import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { DcsLanguageProvider, useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { get_public_form_field_options } from "../services/formsService.js";
import { get_public_follow_up_form, get_public_follow_up_source_record, public_follow_up_upload_endpoint } from "../services/followUpService.js";
import { useLazyFieldResolvers } from "../hooks/useLazyFieldResolvers.js";
import { read_respondent } from "../offline/respondentStore.js";
import { compute_derived_values, compute_form_progress_percent } from "../renderer/formEngine.js";
import { MediaUploadProvider } from "../renderer/MediaUploadContext.jsx";
import { validate_submission_client_side } from "../jsonlogic/validateSubmission.js";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import { format_when } from "../tracking/trackingConfig.js";
import RendererEngine from "../renderer/RendererEngine.jsx";
import DcsSubmitControl from "../components/DcsSubmitControl.jsx";
import DcsFormLoadingSpinner from "../components/DcsFormLoadingSpinner.jsx";
import DcsEmptyState from "../components/DcsEmptyState.jsx";
import DcsErrorBoundary from "../components/DcsErrorBoundary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsRespondentGate from "../components/DcsRespondentGate.jsx";
import PublicFormCardHeader from "../components/PublicFormCardHeader.jsx";
import PublicSuccessScreen from "../components/PublicSuccessScreen.jsx";
import FollowUpSearchOverlay from "../components/followup/FollowUpSearchOverlay.jsx";
import FollowUpRecordOverlay from "../components/followup/FollowUpRecordOverlay.jsx";
import { useFollowUpSubmit } from "../components/followup/useFollowUpSubmit.js";

const FONT = "'Montserrat', sans-serif";
const PRIMARY = "#056daa";

function SourceBanner({ source, translate }) {
  if (!source) return null;
  return (
    <div className="mb-4 p-3 dcs-no-print" style={{ backgroundColor: "#F4F8FB", border: "1px solid rgba(5,109,170,0.2)" }}>
      <p className="text-[11px] font-bold uppercase" style={{ color: PRIMARY, fontFamily: FONT, letterSpacing: "0.5px" }}>
        {translate("DCS_FU_LOADED_FROM", { when: format_when(source.submitted_at) })}
      </p>
    </div>
  );
}

function PublicFollowUpFormPageContent() {
  const { id } = useParams();
  const { translate, language } = useDcsLanguage();
  const { showSuccess, showError } = useToast();

  const [form, setForm] = useState(null);
  const [load_state, setLoadState] = useState("loading");
  const [values, setValues] = useState({});
  const [field_errors, setFieldErrors] = useState({});
  const [field_valid_messages, setFieldValidMessages] = useState({});
  const [reveal_all_errors, setRevealAllErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submit_state, setSubmitState] = useState("idle");
  const [render_reset_key, setRenderResetKey] = useState(0);
  const [file_upload_percent, setFileUploadPercent] = useState(null);
  const [respondent, setRespondent] = useState(null);
  const [saved_respondent] = useState(() => read_respondent());
  const [source, setSource] = useState(null);
  const [search, setSearch] = useState(null);
  const [open_record, setOpenRecord] = useState(null);
  const [picking, setPicking] = useState(false);

  const source_form_group_id = form ? form.source_form_group_id : "";
  const { resolveFieldOptions } = useLazyFieldResolvers("public_form", source_form_group_id, get_public_form_field_options);

  useEffect(() => {
    let is_mounted = true;
    setLoadState("loading");
    get_public_follow_up_form(id)
      .then((response) => {
        if (!is_mounted) return;
        setForm(response.data);
        setLoadState("ready");
      })
      .catch((error) => {
        if (is_mounted) setLoadState(error && error.status_code === 409 ? "no_active_version" : "not_found");
      });
    return () => {
      is_mounted = false;
    };
  }, [id]);

  const field_ids = useMemo(() => new Set(form ? flatten_fields(form.schema.fields).map((field) => field.id) : []), [form]);

  const handle_value_change = (field_id, next_value) => {
    setSubmitState("idle");
    setValues((previous_values) => {
      const merged_values = Object.assign({}, previous_values, { [field_id]: next_value });
      const resolved_values = compute_derived_values(form.schema, merged_values);
      const validation_result = validate_submission_client_side(form.schema, resolved_values, language, translate);
      setFieldErrors(validation_result.field_errors);
      setFieldValidMessages(validation_result.field_valid_messages);
      return validation_result.resolved_data;
    });
  };

  const put_record_values = useCallback(
    (data) => {
      const kept = {};
      Object.keys(data || {}).forEach((key) => {
        if (field_ids.has(key)) kept[key] = data[key];
      });
      setValues(form ? compute_derived_values(form.schema, kept) : {});
      setFieldErrors({});
      setFieldValidMessages({});
      setRevealAllErrors(false);
      setSubmitState("idle");
    },
    [form, field_ids],
  );

  const handle_pick = async (item) => {
    setPicking(true);
    try {
      const response = await get_public_follow_up_source_record(id, item._id);
      const record = response.data && response.data._id ? response.data : item;
      setOpenRecord(record);
    } catch (error) {
      showError(error.message || translate("DCS_FU_RECORD_LOAD_FAILED"));
    } finally {
      setPicking(false);
    }
  };

  const handle_load = (record) => {
    put_record_values(record.data || {});
    setSource({ id: record._id, submitted_at: record.submitted_at });
    setOpenRecord(null);
    setSearch(null);
  };

  const clear_source = () => {
    put_record_values({});
    setSource(null);
    setRenderResetKey((previous_key) => previous_key + 1);
  };

  const { handle_submit } = useFollowUpSubmit({
    form,
    follow_up_group_id: id,
    language,
    translate,
    values,
    respondent,
    source_submission_id: source ? source.id : null,
    showSuccess,
    showError,
    set: {
      submitting: setSubmitting,
      values: setValues,
      field_errors: setFieldErrors,
      field_valid_messages: setFieldValidMessages,
      reveal_all_errors: setRevealAllErrors,
      render_reset_key: setRenderResetKey,
      submit_state: setSubmitState,
      file_upload_percent: setFileUploadPercent,
      source: setSource,
    },
  });

  if (load_state === "loading") return <DcsFormLoadingSpinner />;
  if (load_state === "not_found") return <DcsEmptyState messageKey="DCS_PUBLIC_NOT_FOUND" />;
  if (load_state === "no_active_version") return <DcsEmptyState messageKey="DCS_PUBLIC_NO_ACTIVE_VERSION" />;

  const progress_percent = compute_form_progress_percent(form.schema.fields, values);
  const gate_needed = form.ask_respondent !== false && !respondent;
  const is_success_screen = submit_state === "success_submitted";
  const title = form.form_name || translate("DCS_FU_PUBLIC_TITLE_FALLBACK");
  const busy = submitting || file_upload_percent !== null;

  return (
    <>
      <Helmet>
        <title>{title}</title>
      </Helmet>
      <div
        className="min-h-screen p-0 min-[760px]:px-6 pt-[env(safe-area-inset-top,0px)] min-[760px]:pt-[calc(28px+env(safe-area-inset-top,0px))] pb-[env(safe-area-inset-bottom,0px)] min-[760px]:pb-[calc(24px+env(safe-area-inset-bottom,0px))] flex flex-col items-center dcs-print-page-bg"
        style={{ backgroundColor: "#F7F9FB" }}
      >
        <div className="dcs-no-print" title={translate("DCS_RENDERER_PROGRESS_LABEL", { percent: progress_percent })} style={{ position: "fixed", top: 0, left: 0, width: "100%", zIndex: 40, backgroundColor: "#E0E0E0" }}>
          <div style={{ height: 4, width: `${progress_percent}%`, backgroundColor: PRIMARY, transition: "width 0.3s ease" }} />
        </div>

        <div
          className="w-full min-[760px]:max-w-[700px] bg-white p-4 border-0 min-[760px]:border-[5px] min-[760px]:rounded-[5px] mt-0 min-[760px]:mt-3 mb-0 min-[760px]:mb-6 grow min-[760px]:grow-0 dcs-print-form-card"
          style={{ borderColor: "rgba(5,109,170,0.35)" }}
        >
          <PublicFormCardHeader respondent={respondent} disabled={busy} />

          <div className="mb-4 pb-3" style={{ borderBottom: "1px solid #E0E0E0" }}>
            <p className="text-[11px] font-bold uppercase" style={{ color: "#9E9E9E", fontFamily: FONT, letterSpacing: "0.6px" }}>
              {translate("DCS_FU_PUBLIC_TITLE_FALLBACK")}
            </p>
            <p className="text-lg font-bold break-words" style={{ color: "#333333", fontFamily: FONT }}>
              {title}
            </p>
            <p className="text-xs mt-1" style={{ color: "#9E9E9E", fontFamily: FONT }}>
              {translate("DCS_FU_PUBLIC_HINT")}
            </p>
          </div>

          {is_success_screen ? (
            <PublicSuccessScreen state="success_submitted" onAnother={() => setSubmitState("idle")} />
          ) : (
            <>
              <SourceBanner source={source} translate={translate} />
              <div style={busy ? { pointerEvents: "none", opacity: 0.6 } : undefined}>
                <MediaUploadProvider formGroupId={source_form_group_id} version={form.version} isOnline uploadEndpoint={public_follow_up_upload_endpoint(id)}>
                  <RendererEngine
                    key={render_reset_key}
                    schema={form.schema}
                    mode="renderer"
                    values={values}
                    onValueChange={handle_value_change}
                    fieldErrors={field_errors}
                    fieldValidMessages={field_valid_messages}
                    revealAllErrors={reveal_all_errors}
                    resolveFieldOptions={resolveFieldOptions}
                    searchable={{
                      ids: form.searchable_field_ids || [],
                      onSearch: (field, value) => setSearch({ field, query: value === undefined || value === null ? "" : String(value) }),
                    }}
                  />
                </MediaUploadProvider>
              </div>

              <DcsSubmitControl
                submitting={busy}
                submitState={submit_state}
                onSubmit={handle_submit}
                onIdle={() => setSubmitState("idle")}
                submitLabelKey="DCS_FU_SUBMIT_BTN"
                secondary={
                  source ? (
                    <DcsButtonOutline onClick={clear_source} disabled={busy}>
                      {translate("DCS_FU_CLEAR_LOADED")}
                    </DcsButtonOutline>
                  ) : null
                }
              />
            </>
          )}
        </div>

        {search && (
          <FollowUpSearchOverlay
            followUpGroupId={id}
            field={search.field}
            initialQuery={search.query}
            fields={form.schema.fields}
            picking={picking}
            onPick={handle_pick}
            onClose={() => setSearch(null)}
          />
        )}

        {open_record && <FollowUpRecordOverlay record={open_record} fields={form.schema.fields} onLoad={handle_load} onClose={() => setOpenRecord(null)} />}

        {gate_needed && <DcsRespondentGate saved={saved_respondent} onConfirm={setRespondent} />}
      </div>
    </>
  );
}

export default function PublicFollowUpFormPage() {
  return (
    <DcsErrorBoundary>
      <DcsLanguageProvider>
        <PublicFollowUpFormPageContent />
      </DcsLanguageProvider>
    </DcsErrorBoundary>
  );
}
