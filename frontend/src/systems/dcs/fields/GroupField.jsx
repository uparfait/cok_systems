import React from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { get_field_text } from "./fieldText.js";
import FieldInsertZone from "../builder/FieldInsertZone.jsx";
import SortableGroupChild from "../builder/SortableGroupChild.jsx";
import { reorder_fields } from "../builder/builderUtils.js";
import { get_spacing_below_px } from "../renderer/designStyles.js";
import { DCS_FIELD_RENDERER_MAP } from "../renderer/fieldRendererMap.js";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import { collect_uploaded_file_urls } from "../builder/collectUploadedFileUrls.js";
import { delete_design_file } from "../services/designUploadService.js";

/**
 * Organizes related fields visually together. A group is a container, not
 * a question, so it carries no label of its own - a title over a cluster
 * of questions belongs to a header component above it, where it reads as
 * a heading instead of as a question with no answer. In the builder, each child
 * gets its own live preview plus settings/delete controls, and an "Add
 * field" trigger below the list opens the exact same, single, shared
 * "Choose a component to add" panel the main canvas (and every other
 * group, however deeply nested) opens - never a separate instance of its
 * own - via onRequestAddMenu(field.id), previously the only way to
 * populate a group's children was the JSON import overlay. The live
 * renderer (and the read-only review) instead delegates each child to
 * renderChildField, exactly as before.
 *
 * A group with nothing left to show - every question inside it hidden by
 * the answers so far - draws nothing at all. Its frame is there to gather
 * questions, and an empty frame is not a group, it is a box.
 */
export default function GroupField({ field, language, mode, onFieldChange, onOpenSettings, renderChildField, getFieldError, onRequestAddMenu, searchVisibleIds }) {
  const { translate } = useDcsLanguage();
  const is_builder = mode === "builder";
  const children = field.children || [];

  if (!is_builder) {
    return (
      <div className="dcs-group-box w-full border p-3" style={{ borderColor: "#E0E0E0" }}>
        <div>
          {children.map((child_field) => (
            <div key={child_field.id} className="dcs-field-slot" style={{ marginBottom: get_spacing_below_px(child_field) }}>
              {renderChildField && renderChildField(child_field)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const update_children = (next_children) => {
    onFieldChange && onFieldChange(Object.assign({}, field, { children: next_children }));
  };

  const handle_child_field_change = (child_id, updated_child) => {
    update_children(children.map((child) => (child.id === child_id ? updated_child : child)));
  };

  const handle_delete_child = (child_id) => {
    const removed_child = children.find((child) => child.id === child_id);
    update_children(children.filter((child) => child.id !== child_id));
    collect_uploaded_file_urls(removed_child).forEach((url) => delete_design_file(url));
  };

  const handle_child_drag_end = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from_index = children.findIndex((child) => child.id === active.id);
    const to_index = children.findIndex((child) => child.id === over.id);
    if (from_index === -1 || to_index === -1) return;
    update_children(reorder_fields(children, from_index, to_index));
  };

  // While a search is filtering the canvas, only the children that matched
  // are shown - and dragging is off, because the neighbours a drop would
  // land between are not on screen to aim at. searchVisibleIds is only
  // ever set while a search is running.
  const is_filtered = !!searchVisibleIds;
  const visible_children = is_filtered ? children.filter((child) => searchVisibleIds.has(child.id)) : children;

  return (
    <div className="w-full border p-3" style={{ borderColor: "#E0E0E0" }}>
      <DndContext collisionDetection={closestCenter} onDragEnd={handle_child_drag_end}>
      <SortableContext items={visible_children.map((child) => child.id)} strategy={verticalListSortingStrategy}>
      <div>
        {!is_filtered && <FieldInsertZone onInsert={() => onRequestAddMenu && onRequestAddMenu(field.id, 0)} />}

        {visible_children.map((child) => {
          const ChildComponent = DCS_FIELD_RENDERER_MAP[child.type];
          if (!ChildComponent) return null;
          const child_error = getFieldError ? getFieldError(child.id) : null;
          const child_has_error = !!(child_error && child_error.messages.length > 0);
          const child_index = children.findIndex((candidate) => candidate.id === child.id);
          return (
            <React.Fragment key={child.id}>
            <SortableGroupChild childId={child.id} disabled={is_filtered} hasError={child_has_error}>
              <div className="flex-1 min-w-0">
                <ChildComponent
                  field={child}
                  language={language}
                  mode="builder"
                  onFieldChange={(updated_child) => handle_child_field_change(child.id, updated_child)}
                  onOpenSettings={onOpenSettings}
                  getFieldError={getFieldError}
                  onRequestAddMenu={onRequestAddMenu}
                  searchVisibleIds={searchVisibleIds}
                />
              </div>
              {child_has_error && (
                <div
                  title={child_error.messages.join(" ")}
                  className="absolute flex items-center justify-center"
                  style={{ top: -6, left: -6, width: 15, height: 15, borderRadius: "50%", backgroundColor: "#F39C12", color: "#FFFFFF", fontSize: 10, fontWeight: 700, zIndex: 2 }}
                >
                  !
                </div>
              )}
              <div className="flex flex-col gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={(event) => onOpenSettings && onOpenSettings(child, event.currentTarget.getBoundingClientRect())}
                  className="cursor-pointer p-1.5 border"
                  style={{ borderColor: "#E0E0E0" }}
                  title={translate("DCS_SETTINGS_TITLE")}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#056daa" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => handle_delete_child(child.id)}
                  className="cursor-pointer p-1.5 border"
                  style={{ borderColor: "#E0E0E0" }}
                  title={translate("DCS_BTN_DELETE")}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#E74C3C" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>
            </SortableGroupChild>
            {!is_filtered && (
              <FieldInsertZone onInsert={() => onRequestAddMenu && onRequestAddMenu(field.id, child_index + 1)} />
            )}
            </React.Fragment>
          );
        })}
      </div>
      </SortableContext>
      </DndContext>

      {is_filtered && visible_children.length === 0 && (
        <p className="text-xs py-3" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
          {translate("DCS_SEARCH_FIELD_NO_MATCH_IN_GROUP")}
        </p>
      )}

      {!is_filtered && children.length === 0 && (
        <button
          type="button"
          onClick={() => onRequestAddMenu && onRequestAddMenu(field.id)}
          className="w-full cursor-pointer text-xs text-center px-4 py-6"
          style={{ color: "#9E9E9E", background: "none", border: "none" }}
        >
          {translate("DCS_GROUP_EMPTY_HINT")}
        </button>
      )}
      <DcsButtonOutline className="w-full mt-2" onClick={() => onRequestAddMenu && onRequestAddMenu(field.id, children.length)}>
        {translate("DCS_GROUP_ADD_FIELD")}
      </DcsButtonOutline>
    </div>
  );
}
