import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { DcsLanguageProvider, useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { get_public_form } from "../services/formsService.js";
import { cache_form, get_cached_form } from "../offline/formCache.js";
import { enqueue_submission, process_queue_once, list_queue, start_auto_sync } from "../offline/submissionQueue.js";
import { compute_derived_values } from "../renderer/formEngine.js";
import { validate_submission_client_side } from "../jsonlogic/validateSubmission.js";
import RendererEngine from "../renderer/RendererEngine.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsLoadingState from "../components/DcsLoadingState.jsx";
import DcsEmptyState from "../components/DcsEmptyState.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";
import DcsErrorBoundary from "../components/DcsErrorBoundary.jsx";

/**
 * Strips any "__v<version>" suffix from a shared link - the public link
 * always resolves to whichever version is currently active on the server,
 * regardless of which version number was embedded when it was shared.
 */
function extract_form_group_id(raw_id) {
  return raw_id.split("__v")[0];
}

/**
 * Public, offline-first data collection page behind /dcs-form/:id.
 */
function PublicFormPageContent() {
  const { id } = useParams();
  const { translate, language } = useDcsLanguage();
  const form_group_id = extract_form_group_id(id);

  const [form, setForm] = useState(null);
  const [load_state, setLoadState] = useState("loading");
  const [values, setValues] = useState({});
  const [field_errors, setFieldErrors] = useState({});
  const [field_valid_messages, setFieldValidMessages] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [pending_count, setPendingCount] = useState(0);
  const [is_syncing, setIsSyncing] = useState(false);
  const [is_online, setIsOnline] = useState(window.navigator.onLine);

  const refresh_pending_count = useCallback(async () => {
    try {
      const queue = await list_queue();
      setPendingCount(queue.length);
    } catch (queue_error) {
      console.error(queue_error);
    }
  }, []);

  useEffect(() => {
    let is_mounted = true;

    async function load_form() {
      try {
        const response = await get_public_form(form_group_id);
        if (!is_mounted) return;
        setForm(response.data);
        await cache_form(form_group_id, response.data);
        setLoadState("ready");
      } catch (error) {
        if (error.is_network_error) {
          const cached_form = await get_cached_form(form_group_id);
          if (cached_form && is_mounted) {
            setForm(cached_form);
            setLoadState("ready");
            return;
          }
        }
        if (is_mounted) setLoadState(error.status_code === 409 ? "no_active_version" : "not_found");
      }
    }

    load_form();
    refresh_pending_count();

    const handle_online_change = () => setIsOnline(window.navigator.onLine);
    window.addEventListener("online", handle_online_change);
    window.addEventListener("offline", handle_online_change);

    const stop_auto_sync = start_auto_sync(async (result) => {
      await refresh_pending_count();
      if (result.blocked_item) {
        setIsSyncing(false);
        return;
      }
      if (result.sent_count > 0) setIsSyncing(false);
    });

    return () => {
      is_mounted = false;
      window.removeEventListener("online", handle_online_change);
      window.removeEventListener("offline", handle_online_change);
      stop_auto_sync();
    };
  }, [form_group_id, refresh_pending_count]);

  const handle_value_change = (field_id, next_value) => {
    setValues((previous_values) => {
      const merged_values = Object.assign({}, previous_values, { [field_id]: next_value });
      const resolved_values = compute_derived_values(form.schema, merged_values);
      const validation_result = validate_submission_client_side(form.schema, resolved_values, language, translate);
      setFieldErrors(validation_result.field_errors);
      setFieldValidMessages(validation_result.field_valid_messages);
      return resolved_values;
    });
  };

  const handle_submit = async () => {
    setSubmitting(true);
    try {
      const resolved_values = compute_derived_values(form.schema, values);
      const validation_result = validate_submission_client_side(form.schema, resolved_values, language, translate);
      setFieldErrors(validation_result.field_errors);
      setFieldValidMessages(validation_result.field_valid_messages);
      if (!validation_result.valid) {
        return;
      }
      await enqueue_submission(form_group_id, form.version, resolved_values);
      await refresh_pending_count();

      if (window.navigator.onLine) {
        setIsSyncing(true);
        const result = await process_queue_once();
        await refresh_pending_count();
        setIsSyncing(false);

        if (result.blocked_item) {
          setValues(result.blocked_item.data || {});
          setFieldErrors(result.blocked_item.field_errors || {});
          setFieldValidMessages({});
          return;
        }
      }

      setValues({});
      setFieldErrors({});
      setFieldValidMessages({});
    } finally {
      setSubmitting(false);
    }
  };

  if (load_state === "loading") return <DcsLoadingState messageKey="DCS_PUBLIC_LOADING" />;
  if (load_state === "not_found") return <DcsEmptyState messageKey="DCS_PUBLIC_NOT_FOUND" />;
  if (load_state === "no_active_version") return <DcsEmptyState messageKey="DCS_PUBLIC_NO_ACTIVE_VERSION" />;

  return (
    <div className="min-h-screen p-4 sm:p-6 flex flex-col items-center" style={{ backgroundColor: "#F7F9FB" }}>
      <div className="w-full border-2 bg-white p-4 sm:p-6" style={{ maxWidth: 500, borderColor: "#056daa" }}>
        <RendererEngine
          schema={form.schema}
          mode="renderer"
          values={values}
          onValueChange={handle_value_change}
          fieldErrors={field_errors}
          fieldValidMessages={field_valid_messages}
        />

        <div className="w-full mt-4">
          {submitting ? (
            <SpiralLoader />
          ) : (
            <DcsButtonPrimary className="w-full" onClick={handle_submit} disabled={submitting}>
              {translate("DCS_RENDERER_SUBMIT")}
            </DcsButtonPrimary>
          )}
        </div>

        {!is_online && (
          <div className="w-full mt-3">
            <p className="text-xs px-3 py-2" style={{ backgroundColor: "rgba(243,156,18,0.12)", color: "#F39C12" }}>
              {translate("DCS_PUBLIC_OFFLINE_BANNER")}
            </p>
          </div>
        )}

        {pending_count > 0 && (
          <div className="w-full mt-3">
            <p className="text-xs px-3 py-2" style={{ backgroundColor: "rgba(5,109,170,0.08)", color: "#056daa" }}>
              {is_syncing ? translate("DCS_PUBLIC_SYNCING") : translate("DCS_PUBLIC_QUEUED_COUNT", { count: pending_count })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Wraps the page with its own language provider - this is a standalone
 * public route, not nested under the authenticated DCS shell.
 */
export default function PublicFormPage() {
  return (
    <DcsErrorBoundary>
      <DcsLanguageProvider>
        <PublicFormPageContent />
      </DcsLanguageProvider>
    </DcsErrorBoundary>
  );
}
