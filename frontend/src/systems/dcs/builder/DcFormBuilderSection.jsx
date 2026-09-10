import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import { useEditHistory } from "./useEditHistory.js";
import EditHistoryOverlay, { EditHistoryRestoredDialog, EditHistoryPendingButton } from "./EditHistoryOverlay.jsx";
import { flash_builder_fields } from "./flashBuilderFields.js";
import { collect_search_matches } from "./fieldSearchMatch.js";
import { strip_container_labels } from "./stripContainerLabels.js";
import FieldSearchPanel from "./FieldSearchPanel.jsx";
import { build_schema_error_index, get_field_error_entry } from "./schemaErrorParser.js";
import { find_field_by_id } from "./builderUtils.js";
import { validate_form_schema } from "./validateSchema.js";
import FormBuilderCanvas from "./FormBuilderCanvas.jsx";
import FieldSettingsDrawer from "./FieldSettingsDrawer.jsx";
import ReviewOverlay from "../renderer/ReviewOverlay.jsx";
import DcsFormCodeOverlay from "./DcsFormCodeOverlay.jsx";
import StickyReviewButton from "./StickyReviewButton.jsx";
import { DesignUploadProvider, useDesignUpload } from "./DesignUploadContext.jsx";

/**
 * Section two of project creation: the DC form builder itself - add
 * components, configure them, review the live renderer, then publish.
 */
export default function DcFormBuilderSection(props) {
  return (
    <DesignUploadProvider>
      <DcFormBuilderSectionInner {...props} />
    </DesignUploadProvider>
  );
}

function DcFormBuilderSectionInner({ fields, onFieldsChange, onPublish, publishing, schemaErrors, publishLabelKey, resolveFieldOptions, resolveFullFieldOptions, onValidationChange, trackingScopeId }) {
  const { translate, language } = useDcsLanguage();
  const { showSuccess, showInfo } = useToast();
  const { is_uploading, average_percent } = useDesignUpload();
  const [selected_field_id, setSelectedFieldId] = useState(null);
  const [settings_anchor_rect, setSettingsAnchorRect] = useState(null);
  const [is_reviewing, setIsReviewing] = useState(false);
  const [is_code_overlay_open, setIsCodeOverlayOpen] = useState(false);
  const [is_history_open, setIsHistoryOpen] = useState(false);
  const [is_search_open, setIsSearchOpen] = useState(false);
  const [search_query, setSearchQuery] = useState("");

  const all_flat_fields = flatten_fields(fields);

  // Only a search that is BOTH open and actually typed into filters the
  // canvas - an open, empty search box shows the whole form, so opening it
  // never hides anything by itself.
  const search = useMemo(() => collect_search_matches(fields, is_search_open ? search_query : ""), [fields, is_search_open, search_query]);
  const search_visible_ids = is_search_open && search_query.trim() ? search.visible : null;

  const handle_track_toast = useCallback(
    (message, kind) => {
      if (kind === "success") showSuccess(message);
      else showInfo(message);
    },
    [showSuccess, showInfo],
  );

  const history = useEditHistory({
    scopeId: trackingScopeId,
    fields,
    onFieldsChange,
    translate,
    language,
    onToast: handle_track_toast,
    onHighlight: flash_builder_fields,
  });

  // Every mutation in the builder already funnels through this one
  // callback - the canvas, the settings drawer, the code overlay and a
  // drag alike - so tracking wraps it here instead of each of them having
  // to report what it did. It is also the one place that can hold the form
  // still while the unpublished-edits question is unanswered: editing on
  // top of edits that may yet be restored would build on a state about to
  // be replaced.
  const handle_tracked_fields_change = useCallback(
    (next_fields) => {
      if (history.is_locked) {
        showInfo(translate("DCS_TRACK_LOCKED_TOAST"));
        history.resume_restored();
        return;
      }
      history.track(next_fields);
      onFieldsChange(next_fields);
    },
    [history, onFieldsChange, showInfo, translate],
  );

  // A group or section carries no label any more, but one can still arrive
  // on this page - pasted through the code overlay, brought in with a
  // template, or left on a form authored before the rule. It is taken out
  // of the form here rather than merely not rendered, so the schema that
  // gets published matches what the author is looking at, and the author
  // is told instead of it happening behind their back.
  //
  // Applied through the raw change handler, not the tracked one: this is
  // the app correcting a schema, not an edit the author made, so it is not
  // theirs to undo. Skipped while the form is held, since nothing may
  // change until the unpublished-edits question is answered.
  useEffect(() => {
    if (history.is_locked) return;
    const stripped = strip_container_labels(fields);
    if (stripped.stripped_count === 0) return;
    onFieldsChange(stripped.fields);
    showInfo(translate("DCS_CONTAINER_LABEL_REMOVED", { count: stripped.stripped_count }));
  }, [fields, history.is_locked, onFieldsChange, showInfo, translate]);

  const frontend_validation = useMemo(
    () => validate_form_schema({ fields }),
    [fields],
  );

  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(frontend_validation);
    }
  }, [frontend_validation, onValidationChange]);

  const combined_errors = useMemo(() => {
    const backend_errors = Array.isArray(schemaErrors) ? schemaErrors : [];
    const frontend_errors = Array.isArray(frontend_validation.errors) ? frontend_validation.errors : [];
    const seen = new Set();
    const combined = [];
    for (const error of [...frontend_errors, ...backend_errors]) {
      const key = `${error.path}:${error.reason}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(error);
      }
    }
    return combined;
  }, [schemaErrors, frontend_validation]);

  const schema_error_index = useMemo(
    () => build_schema_error_index(combined_errors, fields, translate),
    [combined_errors, fields, translate],
  );
  const get_field_error = (field_id) => get_field_error_entry(schema_error_index, field_id);

  // The drawer edits a draft of its own, so the index above - built from
  // the fields as they are SAVED - would keep reporting an error the author
  // has already typed the fix for, until they saved and reopened. This
  // revalidates the whole form with the draft swapped in, so the drawer's
  // own errors clear the moment the cause does.
  const get_live_field_error = useCallback(
    (draft_field) => {
      if (!draft_field) return null;
      const substitute = (field_list) =>
        field_list.map((field) => {
          if (field.id === draft_field.id) return draft_field;
          if ((field.type === "group" || field.type === "section") && Array.isArray(field.children)) {
            return Object.assign({}, field, { children: substitute(field.children) });
          }
          return field;
        });
      const draft_fields = substitute(fields);
      const live_errors = validate_form_schema({ fields: draft_fields }).errors || [];
      return get_field_error_entry(build_schema_error_index(live_errors, draft_fields, translate), draft_field.id);
    },
    [fields, translate],
  );

  // The field handed to the drawer is looked up fresh out of the current
  // fields rather than kept as the object clicked on, so an undo or redo
  // while it is open moves it to the live values instead of leaving the
  // author editing a snapshot that no longer exists.
  const selected_field = selected_field_id ? find_field_by_id(fields, selected_field_id) : null;
  const selected_field_error = selected_field ? get_field_error(selected_field.id) : null;

  useEffect(() => {
    const handle_keydown = (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = String(event.key).toLowerCase();
      if (key === "6") {
        event.preventDefault();
        setIsCodeOverlayOpen(true);
      } else if (key === "7" && trackingScopeId) {
        event.preventDefault();
        setIsHistoryOpen(true);
      } else if (key === "f") {
        // Takes over the browser's own find: searching text on the page
        // would only ever land on whichever fields happen to be scrolled
        // into view, while this finds a field anywhere in the form and
        // puts it on screen by itself.
        event.preventDefault();
        setIsSearchOpen(true);
      }
    };
    document.addEventListener("keydown", handle_keydown);
    return () => document.removeEventListener("keydown", handle_keydown);
  }, [trackingScopeId]);

  const handle_open_settings = (field, rect) => {
    if (history.is_locked) {
      showInfo(translate("DCS_TRACK_LOCKED_TOAST"));
      history.resume_restored();
      return;
    }
    setSelectedFieldId(field.id);
    setSettingsAnchorRect(rect || null);
  };

  const handle_settings_save = (updated_field) => {
    const update_recursive = (field_list) =>
      field_list.map((field) => {
        if (field.id === updated_field.id) return updated_field;
        if ((field.type === "group" || field.type === "section") && Array.isArray(field.children)) {
          return Object.assign({}, field, { children: update_recursive(field.children) });
        }
        return field;
      });
    handle_tracked_fields_change(update_recursive(fields));
    setSelectedFieldId(null);
    setSettingsAnchorRect(null);
  };

  const handle_close_settings = () => {
    setSelectedFieldId(null);
    setSettingsAnchorRect(null);
  };

  const schema = { fields };
  const has_validation_errors = combined_errors.length > 0;

  const handle_publish_click = useCallback(async () => {
    if (has_validation_errors) {
      return false;
    }
    if (!onPublish) return false;
    if (history.is_locked) {
      showInfo(translate("DCS_TRACK_LOCKED_TOAST"));
      history.resume_restored();
      return false;
    }
    const did_publish = await onPublish(schema);
    // The tracked edits have become the form itself, so there is no longer
    // an unpublished session to come back to - and leaving one behind
    // would offer to re-apply what is already live. Only a publish that
    // actually succeeded clears it.
    if (did_publish) history.clear();
    return did_publish;
  }, [has_validation_errors, onPublish, schema, history, showInfo, translate]);

  return (
    <div className="space-y-4">
      {has_validation_errors && (
        <div className="text-sm px-3 py-2 rounded-none" style={{ backgroundColor: "rgba(243,156,18,0.12)", color: "#B9770E", fontFamily: "'Montserrat', sans-serif" }}>
          <div className="font-semibold mb-1">{translate("DCS_SCHEMA_ERROR_BANNER")}</div>
          <ul className="list-disc list-inside text-xs space-y-0.5">
            {combined_errors.slice(0, 10).map((error, idx) => (
              <li key={idx}>{translate(`DCS_SCHEMA_ERROR_${error.reason?.toUpperCase?.() || "UNKNOWN"}`)}</li>
            ))}
            {combined_errors.length > 10 && (
              <li>+ {combined_errors.length - 10} {translate("DCS_SCHEMA_ERROR_MORE_COUNT")}</li>
            )}
          </ul>
        </div>
      )}

      {/* Deferring the unpublished-edits question does not make the form
          editable again - it only moves the question aside. The builder is
          held inert until the decision is actually made, since every edit
          made on top of it would be built on a state that is still about
          to be replaced or thrown away. The commit-level guard in
          handle_tracked_fields_change stays as the backstop. */}
      <div
        className={history.is_locked ? "dcs-builder-locked" : undefined}
        aria-disabled={history.is_locked || undefined}
        // pointer-events are off inside, so the reason has to be carried by
        // the wrapper itself for a hover anywhere over the held form to
        // explain what is going on.
        title={
          history.is_locked
            ? translate("DCS_TRACK_PENDING_TOOLTIP", {
                count: history.restored.count,
                when: new Date(history.restored.updated_at).toLocaleString(language === "kn" ? "rw" : language),
              })
            : undefined
        }
      >
        <FormBuilderCanvas
          fields={fields}
          onFieldsChange={handle_tracked_fields_change}
          onOpenSettings={handle_open_settings}
          getFieldError={get_field_error}
          searchVisibleIds={search_visible_ids}
        />
      </div>

      {/* Reviewing stays open while the form is held: looking at the form
          changes nothing, so there is no reason to lock the author out of
          seeing it. Publishing from inside it is what the hold applies to. */}
      {fields.length > 0 && (
        <StickyReviewButton
          label={is_uploading ? translate("DCS_DESIGN_UPLOADING_PERCENT", { percent: average_percent }) : translate("DCS_BTN_REVIEW")}
          disabled={is_uploading || has_validation_errors}
          onClick={() => {
            if (!has_validation_errors) {
              setIsReviewing(true);
            }
          }}
        />
      )}

      {selected_field && (
        <FieldSettingsDrawer
          field={selected_field}
          allFields={all_flat_fields}
          anchorRect={settings_anchor_rect}
          onSave={handle_settings_save}
          onClose={handle_close_settings}
          fieldErrorInfo={selected_field_error}
          getLiveFieldError={get_live_field_error}
          resolveFullFieldOptions={resolveFullFieldOptions}
        />
      )}

      {is_reviewing && (
        <ReviewOverlay
          schema={schema}
          publishing={publishing}
          uploadingFiles={is_uploading}
          uploadPercent={average_percent}
          publishLabelKey={publishLabelKey}
          publishBlockedKey={history.is_locked ? "DCS_TRACK_PUBLISH_BLOCKED" : undefined}
          resolveFieldOptions={resolveFieldOptions}
          onClose={() => setIsReviewing(false)}
          onPublish={async () => {
            const did_succeed = await handle_publish_click();
            if (did_succeed) setIsReviewing(false);
          }}
        />
      )}

      {/* Tracking itself stays out of the way while editing: this asks
          about unpublished edits once, on open, and the history is only
          ever raised deliberately (Ctrl+7). */}
      {!history.is_restored_deferred && (
        <EditHistoryRestoredDialog
          restored={history.restored}
          entries={history.entries}
          onApply={history.apply_restored}
          onDiscard={history.discard_restored}
          onLater={history.defer_restored}
        />
      )}

      {history.restored && history.is_restored_deferred && (
        <EditHistoryPendingButton
          count={history.restored.count}
          when={history.restored.updated_at}
          onClick={history.resume_restored}
        />
      )}

      {is_search_open && (
        <FieldSearchPanel
          query={search_query}
          matchCount={search.count}
          onQueryChange={setSearchQuery}
          onClose={() => {
            setIsSearchOpen(false);
            setSearchQuery("");
          }}
        />
      )}

      {is_history_open && (
        <EditHistoryOverlay
          entries={history.entries}
          cursor={history.cursor}
          canUndo={history.can_undo}
          canRedo={history.can_redo}
          onUndo={history.undo}
          onRedo={history.redo}
          onClear={history.clear}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}

      {is_code_overlay_open && (
        <DcsFormCodeOverlay
          fields={fields}
          allFields={all_flat_fields}
          onCreateForm={(next_fields, mode) => handle_tracked_fields_change(mode === "add" ? fields.concat(next_fields) : next_fields)}
          onClose={() => setIsCodeOverlayOpen(false)}
        />
      )}
    </div>
  );
}
