import React, { useRef, useState } from "react";
import { get_field_text } from "./fieldText.js";
import { DCS_FIELD_TYPE_REGISTRY, create_blank_field } from "./fieldTypes.js";
import { DCS_FIELD_RENDERER_MAP } from "../renderer/fieldRendererMap.js";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsFieldIcon from "../components/DcsFieldIcon.jsx";
import AutoFitContent from "../components/AutoFitContent.jsx";
import SectionChildWrapper from "../builder/SectionChildWrapper.jsx";

const DEFAULT_LAYOUT = { x_percent: 0, y_percent: 0, width_percent: 30, height_percent: 40 };
const MIN_HEIGHT_PX = 80;
const MAX_HEIGHT_PX = 3000;
// Only form design components may live inside a section - no data
// collection components, and never another section.
const ADDABLE_TYPES = DCS_FIELD_TYPE_REGISTRY.filter((entry) => entry.category === "content" && entry.type !== "section");

/**
 * A free-form canvas: unlike every other component (which stacks one per
 * row), a section lets an author place several fields side by side in the
 * same row - right-click anywhere inside it to drop a new field at that
 * spot, then drag/resize each one directly. Every child's position and
 * size is a percentage of the section's own real, on-screen box - it is
 * never rescaled as a whole, so the section always keeps its full
 * declared height and the full width available to it (no side margins).
 * What keeps a child's own content from ever needing to scroll or getting
 * trimmed when its box is small is AutoFitContent, applied per child: it
 * shrinks that one child's content down to fit, never the whole canvas.
 */
export default function SectionField({ field, language, mode, onFieldChange, onOpenSettings, renderChildField }) {
  const is_builder = mode === "builder";
  const { translate } = useDcsLanguage();
  const label = get_field_text(field.label, language);
  const outer_ref = useRef(null);
  const resize_state_ref = useRef(null);
  const [context_menu, setContextMenu] = useState(null);
  const children = field.children || [];
  const height_px = field.height_px || 200;

  const update_children = (next_children) => {
    onFieldChange(Object.assign({}, field, { children: next_children }));
  };

  const handle_child_field_change = (child_id, updated_child) => {
    update_children(children.map((child) => (child.id === child_id ? updated_child : child)));
  };

  const handle_child_layout_change = (child_id, next_layout) => {
    update_children(
      children.map((child) => (child.id === child_id ? Object.assign({}, child, { section_layout: next_layout }) : child)),
    );
  };

  const handle_delete_child = (child_id) => {
    update_children(children.filter((child) => child.id !== child_id));
  };

  const handle_context_menu = (event) => {
    event.preventDefault();
    if (!outer_ref.current) return;
    const box = outer_ref.current.getBoundingClientRect();
    const click_x_percent = Math.min(80, Math.max(0, ((event.clientX - box.left) / box.width) * 100));
    const click_y_percent = Math.min(70, Math.max(0, ((event.clientY - box.top) / box.height) * 100));
    setContextMenu({ screen_x: event.clientX, screen_y: event.clientY, click_x_percent, click_y_percent });
  };

  const handle_add_child = (field_type) => {
    const new_child = create_blank_field(field_type);
    new_child.section_layout = Object.assign({}, DEFAULT_LAYOUT, {
      x_percent: Math.round(context_menu.click_x_percent),
      y_percent: Math.round(context_menu.click_y_percent),
    });
    update_children(children.concat([new_child]));
    setContextMenu(null);
  };

  const start_height_resize = (event) => {
    event.preventDefault();
    resize_state_ref.current = { start_mouse_y: event.clientY, start_height_px: height_px };
    let raf_id = null;
    let latest_move_event = null;

    // Coalesced into at most one update per animation frame, same as
    // every other drag/resize handle - firing a state update on every raw
    // mousemove can outrun React's render cycle and stomp on other
    // just-applied changes.
    const apply_move = () => {
      raf_id = null;
      const resize_state = resize_state_ref.current;
      if (!resize_state || !latest_move_event) return;
      const raw_delta = latest_move_event.clientY - resize_state.start_mouse_y;
      const next_height_px = Math.min(MAX_HEIGHT_PX, Math.max(MIN_HEIGHT_PX, Math.round(resize_state.start_height_px + raw_delta)));
      onFieldChange(Object.assign({}, field, { height_px: next_height_px }));
    };

    const handle_move = (move_event) => {
      latest_move_event = move_event;
      if (raf_id === null) raf_id = requestAnimationFrame(apply_move);
    };
    const handle_up = () => {
      resize_state_ref.current = null;
      if (raf_id !== null) cancelAnimationFrame(raf_id);
      document.removeEventListener("mousemove", handle_move);
      document.removeEventListener("mouseup", handle_up);
    };
    document.addEventListener("mousemove", handle_move);
    document.addEventListener("mouseup", handle_up);
  };

  const background_color = (field.design && field.design.background_color) || "transparent";

  if (!is_builder) {
    // Below 650px the free-form canvas is abandoned entirely: trying to
    // keep every child's exact percentage box on a narrow screen is what
    // was shrinking their content down to near-invisible slivers. Instead
    // each child just stacks full width, in top-to-bottom/left-to-right
    // reading order, like every other ordinary input - no scaling at all.
    const stacked_children = children.slice().sort((child_a, child_b) => {
      const layout_a = child_a.section_layout || DEFAULT_LAYOUT;
      const layout_b = child_b.section_layout || DEFAULT_LAYOUT;
      if (layout_a.y_percent !== layout_b.y_percent) return layout_a.y_percent - layout_b.y_percent;
      return layout_a.x_percent - layout_b.x_percent;
    });

    return (
      <div className="w-full">
        {label && (
          <p className="text-sm font-semibold mb-2" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
            {label}
          </p>
        )}
        <div ref={outer_ref} className="hidden min-[650px]:block relative w-full" style={{ height: height_px, backgroundColor: background_color }}>
          {children.map((child) => {
            const layout = child.section_layout || DEFAULT_LAYOUT;
            return (
              <div
                key={child.id}
                className="absolute"
                style={{ left: `${layout.x_percent}%`, top: `${layout.y_percent}%`, width: `${layout.width_percent}%`, height: `${layout.height_percent}%` }}
              >
                <AutoFitContent>{renderChildField(child)}</AutoFitContent>
              </div>
            );
          })}
        </div>
        <div className="flex min-[650px]:hidden flex-col gap-3 w-full" style={{ backgroundColor: background_color }}>
          {stacked_children.map((child) => (
            <div key={child.id} className="w-full">
              {renderChildField(child)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {label && (
        <p className="text-sm font-semibold mb-2" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
          {label}
        </p>
      )}
      <div
        ref={outer_ref}
        onContextMenu={handle_context_menu}
        onClick={() => context_menu && setContextMenu(null)}
        className="relative w-full border-2 border-dashed"
        style={{ height: height_px, borderColor: "#9E9E9E", backgroundColor: background_color }}
      >
        {children.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-xs text-center px-4" style={{ color: "#9E9E9E" }}>
            {translate("DCS_SECTION_EMPTY_HINT")}
          </p>
        )}

        {children.map((child) => {
          const ChildComponent = DCS_FIELD_RENDERER_MAP[child.type];
          if (!ChildComponent) return null;
          const layout = child.section_layout || DEFAULT_LAYOUT;
          return (
            <SectionChildWrapper
              key={child.id}
              child={child}
              layout={layout}
              sectionRef={outer_ref}
              onLayoutChange={(next_layout) => handle_child_layout_change(child.id, next_layout)}
              onOpenSettings={onOpenSettings}
              onDeleteChild={() => handle_delete_child(child.id)}
            >
              <ChildComponent field={child} language={language} mode="builder" onFieldChange={(updated_child) => handle_child_field_change(child.id, updated_child)} />
            </SectionChildWrapper>
          );
        })}

        <div
          onMouseDown={start_height_resize}
          title={translate("DCS_SECTION_RESIZE_HEIGHT")}
          className="absolute left-0 right-0 flex items-center justify-center"
          style={{ bottom: -6, height: 12, cursor: "ns-resize" }}
        >
          <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "#9E9E9E" }} />
        </div>

        {context_menu && (
          <div
            className="fixed z-[10001] bg-white border shadow-lg py-1"
            style={{ top: context_menu.screen_y, left: context_menu.screen_x, borderColor: "#E0E0E0", width: 220, maxHeight: 320, overflowY: "auto" }}
          >
            {ADDABLE_TYPES.map((entry) => (
              <button
                key={entry.type}
                type="button"
                onClick={() => handle_add_child(entry.type)}
                className="w-full cursor-pointer flex items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-50"
              >
                <DcsFieldIcon type={entry.type} size={16} className="flex-shrink-0" />
                <span className="text-xs" style={{ color: "#333333" }}>{translate(entry.labelKey)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs mt-1" style={{ color: "#9E9E9E" }}>
        {translate("DCS_SECTION_HINT")}
      </p>
    </div>
  );
}
