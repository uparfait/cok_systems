import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { DcsLanguageProvider, useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { get_public_form_field_options } from "../services/formsService.js";
import { get_public_record, update_public_record_full } from "../services/submissionsService.js";
import { useLazyFieldResolvers } from "../hooks/useLazyFieldResolvers.js";
import { compute_derived_values } from "../renderer/formEngine.js";
import { validate_submission_client_side } from "../jsonlogic/validateSubmission.js";
import { MediaUploadProvider } from "../renderer/MediaUploadContext.jsx";
import RendererEngine from "../renderer/RendererEngine.jsx";
import DcsFormLoadingSpinner from "../components/DcsFormLoadingSpinner.jsx";
import DcsEmptyState from "../components/DcsEmptyState.jsx";
import DcsErrorBoundary from "../components/DcsErrorBoundary.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";
import { is_tracking_enabled } from "../tracking/trackingConfig.js";

const FONT = "'Montserrat', sans-serif";
const PRIMARY = "#056daa";

/**
 * The value a tracked field held at a chosen moment, read off the record's
 * own value periods: the period whose window covers that moment. A field
 * with no period recorded yet simply keeps the value it has now.
 */
function values_as_of(record, at) {
  const periods = record.tracking_periods || {};
  const moment = at.getTime();
  const values = Object.assign({}, record.data || {});
  Object.keys(periods).forEach((field_id) => {
    const list = Array.isArray(periods[field_id]) ? periods[field_id] : [];
    const match = list.find((period) => {
      const starts = new Date(period.from).getTime();
      const ends = period.to ? new Date(period.to).getTime() : Infinity;
      return moment >= starts && moment < ends;
    });
    if (match) values[field_id] = match.value;
  });
  return values;
}

/** Every moment this record was written to, newest first. */
function history_moments(record) {
  return (record.history || [])
    .map((entry) => entry.at)
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
}

function EditRecordPageContent() {
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
  // "" means the record as it stands now; any other value is one of its
  // own history moments, shown read-only so a past state can be looked at
  // without being mistaken for what saving would write.
  const [as_of, setAsOf] = useState("");

  const { resolveFieldOptions } = useLazyFieldResolvers("public_form", form ? form.form_group_id : "", get_public_form_field_options);

  useEffect(() => {
    let is_mounted = true;
    setLoadState("loading");
    get_public_record(id)
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

  const moments = useMemo(() => (record ? history_moments(record) : []), [record]);
  const is_tracked = !!record && !!form && is_tracking_enabled(form.tracking);
  const is_past_view = as_of !== "";

  const shown_values = useMemo(() => {
    if (!record || !is_past_view) return values;
    return values_as_of(record, new Date(as_of));
  }, [record, as_of, is_past_view, values]);

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

  // The page opens in a tab of its own from the data table, so leaving it
  // closes that tab; opened any other way (a typed address, a link) it
  // goes back instead.
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
      await update_public_record_full(id, { data: validation_result.resolved_data, respondent: record.respondent || null });
      showSuccess(translate("DCS_EDIT_RECORD_SAVED"));
      leave();
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
        <title>{`${translate("DCS_EDIT_RECORD_TITLE")} - ${form.form_name || ""}`}</title>
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
              {translate("DCS_EDIT_RECORD_TITLE")}
            </p>
            <p className="text-lg font-bold break-words" style={{ color: "#333333", fontFamily: FONT }}>
              {form.form_name}
            </p>
            <p className="text-xs" style={{ color: "#9E9E9E", fontFamily: FONT }}>
              {record.submitted_at ? new Date(record.submitted_at).toLocaleString() : ""}
            </p>
          </div>

          {/* A tracked record keeps every value it has ever held, so it can
              be opened at any of the moments it was written - read-only,
              since saving always writes onto the latest values. */}
          {is_tracked && moments.length > 0 && (
            <div className="mb-4 p-3" style={{ backgroundColor: "#F4F8FB", border: "1px solid rgba(5,109,170,0.2)" }}>
              <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: "#9E9E9E", fontFamily: FONT, letterSpacing: "0.5px" }} htmlFor="dcs-as-of">
                {translate("DCS_EDIT_RECORD_AS_OF")}
              </label>
              <select
                id="dcs-as-of"
                value={as_of}
                onChange={(event) => setAsOf(event.target.value)}
                className="cok-auth-input text-sm cursor-pointer"
                style={{ fontFamily: FONT, height: 38 }}
              >
                <option value="">{translate("DCS_EDIT_RECORD_AS_OF_NOW")}</option>
                {moments.map((moment) => (
                  <option key={moment} value={moment}>
                    {new Date(moment).toLocaleString()}
                  </option>
                ))}
              </select>
              <p className="text-[11px] mt-1.5" style={{ color: "#6B7280", fontFamily: FONT }}>
                {translate("DCS_EDIT_RECORD_TRACKED_HINT")}
              </p>
            </div>
          )}

          <div style={saving || is_past_view ? { pointerEvents: "none", opacity: is_past_view ? 0.75 : 0.6 } : undefined}>
            <MediaUploadProvider formGroupId={form.form_group_id} version={form.version} isOnline>
              <RendererEngine
                key={as_of || "now"}
                schema={form.schema}
                mode="renderer"
                values={shown_values}
                onValueChange={handle_value_change}
                fieldErrors={field_errors}
                fieldValidMessages={field_valid_messages}
                revealAllErrors={reveal_all_errors}
                resolveFieldOptions={resolveFieldOptions}
              />
            </MediaUploadProvider>
          </div>

          {/* The same action row as the public form: both buttons one
              size, rounded, stacked on a phone and side by side from
              tablet width up. */}
          <div className="dcs-form-actions mt-5">
            {saving ? (
              <SpiralLoader />
            ) : (
              <>
                <DcsButtonOutline onClick={leave}>{translate("DCS_BTN_CANCEL")}</DcsButtonOutline>
                <DcsButtonPrimary onClick={handle_save} disabled={is_past_view}>
                  {translate("DCS_EDIT_RECORD_SAVE")}
                </DcsButtonPrimary>
              </>
            )}
          </div>

          {is_past_view && (
            <p className="mt-2 text-xs text-center" style={{ color: PRIMARY, fontFamily: FONT }}>
              {translate("DCS_EDIT_RECORD_AS_OF")} {new Date(as_of).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * The public form, opened on one record that already exists, with every
 * answer filled in and every field open to change - what the pen icon on
 * the data table leads to. Saving re-validates against the exact version
 * the record was collected on and writes the change into the record's own
 * history; on a tracked form the past states stay reachable from the
 * selector at the top.
 */
export default function EditRecordPage() {
  return (
    <DcsErrorBoundary>
      <DcsLanguageProvider>
        <EditRecordPageContent />
      </DcsLanguageProvider>
    </DcsErrorBoundary>
  );
}
