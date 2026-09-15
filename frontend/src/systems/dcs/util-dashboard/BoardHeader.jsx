import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { IconButton, FULLSCREEN_SVG, EXIT_SVG, FIT_SVG, SCROLL_SVG, PLUS_SVG, MOON_SVG, SUN_SVG, TRASH_SVG } from "./BoardIcons.jsx";
import { useBoardTheme } from "./boardTheme.jsx";
import GenerationProgress from "./GenerationProgress.jsx";
import DcsPeriodFilter from "../components/DcsPeriodFilter.jsx";

/**
 * The dashboard page's header: the uppercase board title, every control as
 * an icon button with a hover title (fit/scroll modes and exit in full
 * screen, full screen, regenerate and delete otherwise), the generation
 * progress readout and the board-wide period filter. In full screen it is
 * fixed to the top, hides itself shortly after the pointer leaves and
 * slides back in when the top strip is hovered. While the board is busy
 * (generating, or the post-generation review is open) every action and the
 * period filter disappear - nothing may trigger a data fetch until the
 * review is finished or canceled.
 */
export default function BoardHeader({
  form,
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
  onAddKpi,
  onDelete,
}) {
  const { translate } = useDcsLanguage();
  const board = useBoardTheme();
  const busy = generating || reviewing;

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
          <h2
            className="min-w-0 truncate"
            style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--board-text, #333333)", textTransform: "uppercase", letterSpacing: "0.3px" }}
          >
            {translate("DCS_DB_BOARD_TITLE", { name: form.form_name || form.form_group_id })}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {/* The viewer's own light / dark mode - a browser preference,
                never saved to the dashboard, so it is offered to everyone. */}
            <IconButton title={translate(board.is_dark ? "DCS_DB_THEME_LIGHT" : "DCS_DB_THEME_DARK")} onClick={board.toggle} active={board.is_dark}>
              {board.is_dark ? SUN_SVG : MOON_SVG}
            </IconButton>
            {is_fullscreen && !busy && (
              <IconButton title={translate("DCS_DB_FIT_MODE")} onClick={() => setFsMode("fit")} active={fs_mode === "fit"}>
                {FIT_SVG}
              </IconButton>
            )}
            {is_fullscreen && !busy && (
              <IconButton title={translate("DCS_DB_SCROLL_MODE")} onClick={() => setFsMode("scroll")} active={fs_mode === "scroll"}>
                {SCROLL_SVG}
              </IconButton>
            )}
            {widgets_count > 0 && !busy && (
              <IconButton
                title={translate(is_fullscreen ? "DCS_DB_EXIT_FULLSCREEN" : "DCS_DB_FULLSCREEN")}
                onClick={is_fullscreen ? exit : enter}
              >
                {is_fullscreen ? EXIT_SVG : FULLSCREEN_SVG}
              </IconButton>
            )}
            {can_edit && widgets_count > 0 && !busy && !is_fullscreen && (
              <>
                <IconButton title={translate("DCS_DB_ADD_KPI")} onClick={onAddKpi} disabled={deleting}>
                  {PLUS_SVG}
                </IconButton>
                <IconButton title={translate("DCS_DB_BTN_DELETE")} onClick={onDelete} danger disabled={deleting}>
                  {TRASH_SVG}
                </IconButton>
              </>
            )}
          </div>
          <style>{`.dcs-db-iconbtn { transition: background-color 160ms ease, color 160ms ease, transform 120ms ease; } .dcs-db-iconbtn:hover:not(:disabled) { transform: translateY(-1px); }`}</style>
        </div>
        {generating && <GenerationProgress percent={progress.percent} messageKey={progress.message_key} />}
        {widgets_count > 0 && !busy && (
          <DcsPeriodFilter
            period={period}
            onPeriodChange={setPeriod}
            from={from}
            onFromChange={setFrom}
            to={to}
            onToChange={setTo}
            onApply={onApplyPeriod}
            allowWrap
          />
        )}
      </div>
    </>
  );
}
