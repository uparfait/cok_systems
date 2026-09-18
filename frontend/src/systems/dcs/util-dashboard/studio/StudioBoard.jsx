import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { useToast } from "../../../../core/contexts/ToastContext.tsx";
import { useBoardTheme } from "../boardTheme.jsx";
import { save_dashboard, request_error_text } from "../dashboardService.js";
import { finalize_widgets } from "../builder/composeWidgets.js";
import DcsConfirmDialog from "../../components/DcsConfirmDialog.jsx";
import { IconButton, CLOSE_SVG } from "../BoardIcons.jsx";
import BoardGrid from "../BoardGrid.jsx";
import StudioToolbar from "./StudioToolbar.jsx";
import { useBoardStudio } from "./useBoardStudio.js";
import { is_studio, board_width, studio_layout } from "../boxLayout.js";
import { portal_root } from "../portalRoot.js";

const PRIMARY = "#056daa";
const FONT = { fontFamily: "'Montserrat', sans-serif" };
const LIGHT_BG = "#F4F7F9";
const DARK_BG = "#0F171F";

/**
 * The board, and the STUDIO it is arranged in.
 *
 * Off, this is the ordinary board. On, it is the screenshot studio's own
 * shell around the live board: a FULL SCREEN overlay, its own title bar
 * with a way out, the board scrolling inside it, and three buttons in the
 * corner. Full screen because arranging a page inside a column of that
 * page is arranging it at the wrong size - what is laid out is what is
 * then seen.
 *
 * Nothing in here reaches the server until Save changes is pressed, so the
 * whole session is one write of the whole board.
 */
export default function StudioBoard({ form, fields, widgets, layout, editable, onSaved, onSelectionChange, onSelectionApi, ...grid_props }) {
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const board = useBoardTheme();
  const studio = useBoardStudio(widgets, layout);
  const [confirm_exit, setConfirmExit] = useState(false);
  const [saving, setSaving] = useState(false);

  // The page follows the mode: filters, for one, stop applying while the
  // board is being arranged.
  useEffect(() => {
    if (onSelectionChange) onSelectionChange(studio.active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studio.active]);

  const request_exit = () => {
    if (studio.dirty) setConfirmExit(true);
    else studio.exit();
  };

  // Where the board shows every widget, and at what size, measured the way
  // the screenshot studio measures it: each card against the board, any
  // fit zoom undone. This is what the studio opens on.
  const board_ref = useRef(null);
  const measure_board = () => {
    const grid = board_ref.current;
    if (!grid) return null;
    const box = grid.getBoundingClientRect();
    const ratio = grid.offsetWidth ? box.width / grid.offsetWidth : 1;
    const rects = Array.from(grid.querySelectorAll("[data-widget-id]")).map((node) => {
      const rect = node.getBoundingClientRect();
      return { id: node.getAttribute("data-widget-id"), x: (rect.left - box.left) / ratio, y: (rect.top - box.top) / ratio, w: rect.width / ratio, h: rect.height / ratio };
    });
    return { rects, base: { w: grid.offsetWidth, h: grid.offsetHeight } };
  };

  // The board's own right-click menu owns the way in and out; the ref
  // keeps what it is handed stable, so handing it over does not set the
  // page re-rendering.
  const latest = useRef(null);
  latest.current = () => {
    if (studio.active) request_exit();
    else studio.enter(measure_board());
  };
  const arrangement = useRef(null);
  arrangement.current = () => studio.set_layout(is_studio(studio.layout) ? { mode: "grid", width: board_width(studio.layout) } : studio_layout(window.innerWidth));
  const studio_now = useRef(false);
  studio_now.current = is_studio(studio.active ? studio.layout : layout);
  const api = useRef({
    toggle: () => latest.current(),
    arrangement: () => arrangement.current(),
    is_studio: () => studio_now.current,
  });
  useEffect(() => {
    if (onSelectionApi) onSelectionApi(api.current);
  }, [onSelectionApi]);

  const handle_save = async () => {
    setSaving(true);
    try {
      const positioned = finalize_widgets(studio.working);
      const saved = await save_dashboard(form, positioned, undefined, studio.layout);
      const final_widgets = (saved.data && saved.data.widgets) || positioned;
      const final_layout = (saved.data && saved.data.layout) || studio.layout;
      showSuccess(translate("DCS_DB_SEL_SAVED"));
      studio.exit();
      onSaved(final_widgets, final_layout);
    } catch (error) {
      showError(request_error_text(error, translate("DCS_ERROR_GENERIC")));
    } finally {
      setSaving(false);
    }
  };

  const surface = (
    <BoardGrid
      {...grid_props}
      form={form}
      fields={fields}
      layout={studio.active ? studio.layout : layout}
      widgets={studio.active ? studio.working : widgets}
      editable={editable && !studio.active}
      studio={studio.active ? { onMove: studio.move, onResize: studio.resize, onPlace: studio.place, onRemove: studio.remove } : null}
    />
  );

  if (!studio.active) return <div ref={board_ref}>{surface}</div>;

  const background = board.is_dark ? DARK_BG : LIGHT_BG;
  return (
    <>
      {createPortal(
        <div className={`dcs-studio-root fixed inset-0 z-[10000] flex flex-col ${board.is_dark ? "dcs-board-dark dcs-board-dark-portal" : ""}`} style={{ backgroundColor: background }}>
          <div className="flex items-center justify-between gap-3 flex-shrink-0 px-4 sm:px-5 py-2" style={{ backgroundColor: PRIMARY }}>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase leading-tight truncate" style={{ color: "#FFFFFF", letterSpacing: "0.3px", ...FONT }}>
                {translate("DCS_DB_SEL_ON")}
              </p>
              <p className="text-[11px] font-semibold truncate" style={{ color: "rgba(255,255,255,0.85)", ...FONT }}>
                {translate("DCS_DB_SEL_HINT")}
              </p>
            </div>
            <IconButton title={translate("DCS_BTN_CLOSE")} onClick={request_exit} onDark danger disabled={saving}>
              {CLOSE_SVG}
            </IconButton>
          </div>

          {/* The screenshot studio's own ground: a faint grid to place
              things against, and the board standing on it inside its own
              border, so its edges are seen and nothing is placed off them. */}
          <div className="dcs-board-root dcs-studio-scroll flex-1 min-h-0 overflow-auto">
            {surface}
          </div>

          <div className="flex-shrink-0 px-3 sm:px-4 py-2 flex justify-end" style={{ backgroundColor: background }}>
            <StudioToolbar dirty={studio.dirty} saving={saving} onSave={handle_save} onDiscard={studio.discard} onExit={request_exit} />
          </div>
        </div>,
        portal_root(),
      )}
      {confirm_exit && (
        <DcsConfirmDialog
          titleKey="DCS_DB_SEL_DISCARD_TITLE"
          messageKey="DCS_DB_SEL_DISCARD_MESSAGE"
          onCancel={() => setConfirmExit(false)}
          onConfirm={() => {
            setConfirmExit(false);
            studio.exit();
          }}
        />
      )}
    </>
  );
}
