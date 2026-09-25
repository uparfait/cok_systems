import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { FULLSCREEN_SVG, EXIT_SVG, FIT_SVG, SCROLL_SVG, PLUS_SVG, LINK_SVG, MOON_SVG, SUN_SVG, TRASH_SVG, CAMERA_SVG } from "./BoardIcons.jsx";
import BoardActionsMenu from "./BoardActionsMenu.jsx";
import { useBoardTheme } from "./boardTheme.jsx";
import GenerationProgress from "./GenerationProgress.jsx";
import DcsPeriodFilter from "../components/DcsPeriodFilter.jsx";
import BoardFilters from "./filters/BoardFilters.jsx";

/**
 * The dashboard page's header: the board title - the dashboard switcher on
 * the signed-in page, the shared dashboard's name on the public one - one "Actions"
 * dropdown holding every control the viewer may use (the light / dark
 * mode, the fit and scroll views, full screen, the builder, share links
 * and deletion - each with its icon and name), the generation progress
 * readout, the board-wide period filter and the board's own filters (one
 * select per filter field chosen in the builder's Filters tab - see
 * filters/BoardFilters.jsx), all in one row that scrolls sideways. In full screen it is fixed to
 * the top, hides itself shortly after the pointer leaves and slides back
 * in when the top strip is hovered. While the board is busy (generating,
 * or the post-generation review is open) the actions and the period filter
 * disappear - nothing may trigger a data fetch until the review is
 * finished or canceled.
 */
export default function BoardHeader({
  form,
  title,
  widgets_count,
  can_edit,
  generating,
  reviewing,
  deleting,
  progress,
  is_fullscreen,
  fs_mode,
  setFsMode,
  enter,
  exit,
  header_visible,
  show_header,
  schedule_header_hide,
  period,
  setPeriod,
  from,
  setFrom,
  to,
  setTo,
  onApplyPeriod,
  filters,
  fields,
  widgets,
  filterValues,
  onFilterValue,
  onFilterValues,
  onChangeFilters,
  fetchFilterValues,
  lockedFilterIds,
  lockedPeriod,
  onAddKpi,
  onShare,
  onDelete,
  onScreenshot,
  onResetPeriod,
}) {
  const { translate } = useDcsLanguage();
  const board = useBoardTheme();
  const busy = generating || reviewing;
  // The viewer's own light / dark mode is always offered; the viewing modes
  // follow full screen, and the editing actions the viewer's rights.
  const actions = [
    // A page pinned to one mode by its share link offers no switch.
    !board.is_fixed && { key: "theme", label: translate(board.is_dark ? "DCS_DB_THEME_LIGHT" : "DCS_DB_THEME_DARK"), icon: board.is_dark ? SUN_SVG : MOON_SVG, onClick: board.toggle, active: board.is_dark },
    is_fullscreen && !busy && { key: "fit", label: translate("DCS_DB_FIT_MODE"), icon: FIT_SVG, onClick: () => setFsMode("fit"), active: fs_mode === "fit" },
    is_fullscreen && !busy && { key: "scroll", label: translate("DCS_DB_SCROLL_MODE"), icon: SCROLL_SVG, onClick: () => setFsMode("scroll"), active: fs_mode === "scroll" },
    widgets_count > 0 && !busy && onScreenshot && { key: "screenshot", label: translate("DCS_DB_SCREENSHOT"), icon: CAMERA_SVG, onClick: onScreenshot },
    widgets_count > 0 && !busy && { key: "fullscreen", label: translate(is_fullscreen ? "DCS_DB_EXIT_FULLSCREEN" : "DCS_DB_FULLSCREEN"), icon: is_fullscreen ? EXIT_SVG : FULLSCREEN_SVG, onClick: is_fullscreen ? exit : enter },
    can_edit && widgets_count > 0 && !busy && !is_fullscreen && { key: "build", label: translate("DCS_DB_ADD_KPI"), icon: PLUS_SVG, onClick: onAddKpi, disabled: deleting },
    can_edit && widgets_count > 0 && !busy && !is_fullscreen && onShare && { key: "share", label: translate("DCS_DB_SHARE_LINKS"), icon: LINK_SVG, onClick: onShare, disabled: deleting },
    can_edit && !busy && !is_fullscreen && onDelete && { key: "delete", label: translate("DCS_DB_BTN_DELETE"), icon: TRASH_SVG, onClick: onDelete, danger: true, disabled: deleting },
  ];

  return (
    <>
      {is_fullscreen && (
        // Invisible strip along the top edge: hovering it (or touching it)
        // slides the fixed header back in.
        <div
          className="fixed top-0 left-0 right-0"
          style={{ height: 22, zIndex: 29 }}
          onMouseEnter={show_header}
          onTouchStart={() => {
            show_header();
            schedule_header_hide(2500);
          }}
        />
      )}
      <div
        className="dcs-board-chrome border-2 px-3 py-2 sm:px-4 flex flex-col gap-2"
        onMouseEnter={is_fullscreen ? show_header : undefined}
        onMouseLeave={is_fullscreen ? () => schedule_header_hide(100) : undefined}
        style={{
          ...(is_fullscreen
            ? {
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                zIndex: 30,
                opacity: header_visible ? 1 : 0,
                transform: header_visible ? "translateY(0)" : "translateY(-105%)",
                pointerEvents: header_visible ? "auto" : "none",
                transition: "opacity 240ms ease, transform 240ms ease",
                boxShadow: "0 6px 18px rgba(0,0,0,0.14)",
              }
            : {}),
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          {title && typeof title !== "string" ? (
            <div className="min-w-0 flex-1 flex items-center">{title}</div>
          ) : (
            <h2
              className="min-w-0 truncate"
              style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--board-text, #333333)", textTransform: "uppercase", letterSpacing: "0.3px" }}
            >
              {title || translate("DCS_DB_BOARD_TITLE", { name: form.form_name || form.form_group_id })}
            </h2>
          )}
          <BoardActionsMenu items={actions} />
          <style>{`.dcs-db-iconbtn { transition: background-color 160ms ease, color 160ms ease, transform 120ms ease; } .dcs-db-iconbtn:hover:not(:disabled) { transform: translateY(-1px); }`}</style>
        </div>
        {generating && <GenerationProgress percent={progress.percent} messageKey={progress.message_key} />}
        {widgets_count > 0 && !busy && (
          <div className="dcs-board-filter-row">
            <DcsPeriodFilter
              period={lockedPeriod ? lockedPeriod.preset : period}
              onPeriodChange={setPeriod}
              from={lockedPeriod ? lockedPeriod.from || "" : from}
              onFromChange={setFrom}
              to={lockedPeriod ? lockedPeriod.to || "" : to}
              onToChange={setTo}
              onApply={onApplyPeriod}
              includeAll={!!lockedPeriod}
              locked={!!lockedPeriod}
              plain
            />
            {fetchFilterValues && (
              <BoardFilters
                filters={filters}
                fields={fields || []}
                values={filterValues}
                onValue={onFilterValue}
                onValues={onFilterValues}
                fetchValues={fetchFilterValues}
                lockedIds={lockedFilterIds}
                disabled={deleting}
                onReorder={onChangeFilters}
                onClearPeriod={lockedPeriod ? undefined : onResetPeriod}
                periodChanged={!lockedPeriod && (period !== "this_year" || !!from || !!to)}
                refreshKey={`${JSON.stringify(filterValues || {})}|${period}|${from}|${to}`}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}
