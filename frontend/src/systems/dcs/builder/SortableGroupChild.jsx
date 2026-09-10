import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

/**
 * One child of a group, draggable within that group. The group's children
 * are an ordered list the respondent reads in order, so they need the same
 * reordering the top-level canvas has always had - previously the only way
 * to change their order was to delete and re-add them.
 *
 * The handle is deliberately the only draggable part: the child's own
 * preview stays clickable so its inline controls and settings button keep
 * working, which is what dragging the whole row would have taken away.
 * disabled turns the handle off while the canvas is filtered by a search,
 * where the fields a drop would land between are not on screen.
 */
export default function SortableGroupChild({ childId, disabled, hasError, children }) {
  const { translate } = useDcsLanguage();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: childId,
    disabled: !!disabled,
  });

  return (
    <div
      ref={setNodeRef}
      data-builder-field-id={childId}
      className="border p-2 flex gap-2"
      style={{
        position: "relative",
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 2 : undefined,
        backgroundColor: hasError ? "rgba(243,156,18,0.08)" : "#FFFFFF",
        borderColor: hasError ? "#F39C12" : "#E0E0E0",
      }}
    >
      {!disabled && (
        <button
          type="button"
          className="dcs-group-child-grip flex-shrink-0"
          title={translate("DCS_GROUP_CHILD_DRAG_HINT")}
          aria-label={translate("DCS_GROUP_CHILD_DRAG_HINT")}
          {...attributes}
          {...listeners}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9E9E9E" strokeWidth="2.4" strokeLinecap="round">
            <line x1="4" y1="8" x2="20" y2="8" />
            <line x1="4" y1="16" x2="20" y2="16" />
          </svg>
        </button>
      )}
      {children}
    </div>
  );
}
