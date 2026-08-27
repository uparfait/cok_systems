import React, { useState } from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { create_blank_field } from "../fields/fieldTypes.js";
import { update_field_by_id, delete_field_by_id, find_field_by_id, insert_field_at, reorder_fields } from "./builderUtils.js";
import { collect_uploaded_file_urls } from "./collectUploadedFileUrls.js";
import { delete_design_file } from "../services/designUploadService.js";
import { get_spacing_below_px } from "../renderer/designStyles.js";
import AddComponentPanel from "./AddComponentPanel.jsx";
import BuilderFieldRow from "./BuilderFieldRow.jsx";
import BuilderStaticFieldPreview from "./BuilderStaticFieldPreview.jsx";
import DcsEmptyState from "../components/DcsEmptyState.jsx";

/**
 * The drag-and-drop form builder canvas: every question shows an "add
 * below" trigger, a settings gear and a delete button, and can be
 * reordered by dragging its handle. Exactly one AddComponentPanel exists
 * for the whole canvas - the top-level "+" trigger and every group's own
 * "Add field" button (however deeply nested) all open this same shared
 * instance rather than each mounting a separate copy with its own
 * separate templates list/polling; add_panel_group_id tracks which one
 * (null for the top-level canvas itself) the next pick actually goes into.
 */
export default function FormBuilderCanvas({ fields, onFieldsChange, onOpenSettings, getFieldError }) {
  const { language, translate } = useDcsLanguage();
  const [is_add_panel_open, setIsAddPanelOpen] = useState(false);
  const [add_panel_group_id, setAddPanelGroupId] = useState(null);

  const open_add_panel = (group_id) => {
    setAddPanelGroupId(group_id || null);
    setIsAddPanelOpen(true);
  };

  const handle_add_component = (field_type) => {
    const new_field = create_blank_field(field_type);
    if (add_panel_group_id) {
      onFieldsChange(
        update_field_by_id(fields, add_panel_group_id, (group) =>
          Object.assign({}, group, { children: (group.children || []).concat([new_field]) }),
        ),
      );
    } else {
      onFieldsChange(insert_field_at(fields, fields.length - 1, new_field));
    }
    // A brand new group starts with zero children - keeping the panel open,
    // now targeting straight at it, saves the extra click of finding and
    // pressing its own "Add field" trigger on an otherwise-empty box.
    if (field_type === "group") {
      setAddPanelGroupId(new_field.id);
    } else {
      setIsAddPanelOpen(false);
    }
  };

  // "add" keeps every field already in the target (the canvas, or one
  // group's own children) and appends the template's (checked) fields
  // after them; "overwrite" replaces the whole target with just those
  // fields, mirroring the JSON overlay's own replace behavior but scoped
  // to only what was checked.
  const handle_insert_template = (inserted_fields, mode) => {
    if (add_panel_group_id) {
      onFieldsChange(
        update_field_by_id(fields, add_panel_group_id, (group) =>
          Object.assign({}, group, {
            children: mode === "overwrite" ? inserted_fields : (group.children || []).concat(inserted_fields),
          }),
        ),
      );
    } else {
      onFieldsChange(mode === "overwrite" ? inserted_fields : fields.concat(inserted_fields));
    }
    setIsAddPanelOpen(false);
  };

  const handle_delete_field = (field_id) => {
    const removed_field = find_field_by_id(fields, field_id);
    onFieldsChange(delete_field_by_id(fields, field_id));
    collect_uploaded_file_urls(removed_field).forEach((url) => delete_design_file(url));
  };

  const handle_field_inline_change = (updated_field) => {
    onFieldsChange(update_field_by_id(fields, updated_field.id, () => updated_field));
  };

  const handle_drag_end = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from_index = fields.findIndex((field) => field.id === active.id);
    const to_index = fields.findIndex((field) => field.id === over.id);
    if (from_index === -1 || to_index === -1) return;
    onFieldsChange(reorder_fields(fields, from_index, to_index));
  };

  const render_child_field = (child_field) => (
    <BuilderStaticFieldPreview field={child_field} language={language} onOpenSettings={onOpenSettings} getFieldError={getFieldError} />
  );

  return (
    <div className="w-full" style={{ userSelect: "none" }}>
      {fields.length === 0 && <DcsEmptyState messageKey="DCS_EMPTY_FORM_CANVAS" />}

      <DndContext collisionDetection={closestCenter} onDragEnd={handle_drag_end}>
        <SortableContext items={fields.map((field) => field.id)} strategy={verticalListSortingStrategy}>
          {fields.map((field) => (
            // The gap below each row is whatever the author set for that
            // field (Designs tab), not one hardcoded value shared by every
            // row - matches how RendererEngine spaces the live/review form,
            // so the canvas shows the real distance the author chose.
            <div key={field.id} style={{ marginBottom: get_spacing_below_px(field) }}>
              <BuilderFieldRow
                field={field}
                language={language}
                onOpenSettings={(rect) => onOpenSettings(field, rect)}
                onOpenChildSettings={onOpenSettings}
                onDelete={() => handle_delete_field(field.id)}
                onFieldChange={handle_field_inline_change}
                renderChildField={render_child_field}
                getFieldError={getFieldError}
                onRequestAddMenu={open_add_panel}
              />
            </div>
          ))}
        </SortableContext>
      </DndContext>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => open_add_panel(null)}
          className="cok-btn-outlined flex items-center justify-center"
          style={{ width: 100, height: 40 }}
          aria-label={translate("DCS_BTN_ADD_COMPONENT")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <AddComponentPanel
        isOpen={is_add_panel_open}
        onClose={() => setIsAddPanelOpen(false)}
        onSelect={handle_add_component}
        onInsertTemplate={handle_insert_template}
      />
    </div>
  );
}
