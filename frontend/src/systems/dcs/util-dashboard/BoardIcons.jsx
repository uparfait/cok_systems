import React from "react";

const PRIMARY = "#056daa";
const DANGER = "#E74C3C";

/**
 * The dashboard's compact SVG icon buttons: every control is an icon whose
 * meaning is spoken by its title tooltip (and aria-label) on hover. An
 * active state fills the button solid for toggle pairs like Fit/Scroll.
 *
 * onDark is for a button sitting on one of the solid system-blue header
 * bands: it carries no fill of its own there, drawing itself in white on
 * whatever is behind it, since a white chip on that band reads as a hole
 * punched in the header. Danger loses its red there too - red on blue is
 * the one pairing that band cannot carry legibly.
 */
export function IconButton({ title, onClick, danger, active, onDark, disabled, children }) {
  const base_color = danger ? DANGER : PRIMARY;
  const surface_style = onDark
    ? {
        border: "1px solid rgba(255, 255, 255, 0.55)",
        color: "#FFFFFF",
        backgroundColor: active ? "rgba(255, 255, 255, 0.22)" : "transparent",
      }
    : {
        border: `1px solid ${base_color}`,
        color: active ? "#FFFFFF" : base_color,
        backgroundColor: active ? base_color : "#FFFFFF",
      };
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className="dcs-db-iconbtn flex items-center justify-center flex-shrink-0"
      style={{
        width: 36,
        height: 36,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        ...surface_style,
      }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}

export const FULLSCREEN_SVG = (
  <>
    <path d="M8 3H3v5" />
    <path d="M16 3h5v5" />
    <path d="M8 21H3v-5" />
    <path d="M16 21h5v-5" />
  </>
);

export const EXIT_SVG = (
  <>
    <path d="M3 8h5V3" />
    <path d="M21 8h-5V3" />
    <path d="M3 16h5v5" />
    <path d="M21 16h-5v5" />
  </>
);

export const FIT_SVG = (
  <>
    <rect x="3" y="5" width="18" height="14" />
    <rect x="8.5" y="9.5" width="7" height="5" fill="currentColor" stroke="none" />
  </>
);

export const SCROLL_SVG = (
  <>
    <path d="M12 4v16" />
    <polyline points="8 8 12 4 16 8" />
    <polyline points="8 16 12 20 16 16" />
  </>
);

export const CLOSE_SVG = (
  <>
    <path d="M6 6l12 12" />
    <path d="M18 6L6 18" />
  </>
);

export const PLUS_SVG = (
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>
);

export const REFRESH_SVG = (
  <>
    <polyline points="21 3 21 9 15 9" />
    <path d="M20.5 9a9 9 0 1 0 0.5 3" />
  </>
);

export const TRASH_SVG = (
  <>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </>
);
