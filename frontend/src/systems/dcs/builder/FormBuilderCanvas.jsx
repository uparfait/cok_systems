import React from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { create_blank_field } from "../fields/fieldTypes.js";
import { update_field_by_id, delete_field_by_id, insert_field_at, reorder_fields } from "./builderUtils.js";
import { get_spacing_below_px } from "../renderer/designStyles.js";
import AddComponentPanel from "./AddComponentPanel.jsx";
import BuilderFieldRow from "./BuilderFieldRow.jsx";
import BuilderStaticFieldPreview from "./BuilderStaticFieldPreview.jsx";
import DcsEmptyState from "../components/DcsEmptyState.jsx";

/**
 * The drag-and-drop form builder canvas: every question shows an "add
 * below" trigger, a settings gear and a delete button, and can be
 * reordered by dragging its handle.
 */
export default function FormBuilderCanvas({ fields, onFieldsChange, onOpenSettings }) {
  const { language } = useDcsLanguage();

  const handle_add_component = (field_type) => {
    const new_field = create_blank_field(field_type);
    onFieldsChange(insert_field_at(fields, fields.length - 1, new_field));
  };

  const handle_delete_field = (field_id) => {
    onFieldsChange(delete_field_by_id(fields, field_id));
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
    <BuilderStaticFieldPreview field={child_field} language={language} onOpenSettings={onOpenSettings} />
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
              />
            </div>
          ))}
        </SortableContext>
      </DndContext>

      <AddComponentPanel onSelect={handle_add_component} />
    </div>
  );
}
