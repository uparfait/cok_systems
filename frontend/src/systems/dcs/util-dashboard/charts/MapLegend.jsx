import React, { useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { with_alpha } from "../appearance.js";
import LibraryIcon from "../icons/LibraryIcon.jsx";

const PREVIEW = 6;

/**
 * What every color on the map stands for. A plain map lists its places,
 * each in the color its own boundary is filled with and followed by its
 * number. A map split by a field (status, gender) lists THOSE values
 * instead - every place is painted the color of the value that leads it -
 * with the total of each and, when the map plants markers, the marker that
 * value carries. The list opens with the first few and a "Show more" line,
 * like every other chart's legend.
 *
 * Places the form holds answers for but the city has no boundary for are
 * named at the end, so nobody is left wondering where they went.
 */
export default function MapLegend({ items, palette, onPick, unknown }) {
  const { translate } = useDcsLanguage();
  const [open, setOpen] = useState(false);
  const list = items || [];
  const shown = open ? list : list.slice(0, PREVIEW);
  const missing = (unknown || []).length;

  return (
    <div className="dcs-map-legend">
      {list.length > 0 && (
        <div className="dcs-map-legend-items">
          {shown.map((item) => (
            <button
              key={item.key}
              type="button"
              className="dcs-map-legend-item"
              style={{ color: palette.text, cursor: onPick ? "pointer" : "default" }}
              onClick={onPick ? () => onPick(item) : undefined}
            >
              {item.icon ? (
                <LibraryIcon icon={item.icon} size={13} color={item.color} />
              ) : (
                <span className="dcs-map-legend-swatch" style={{ borderColor: item.color, backgroundColor: with_alpha(item.color, 0.7) }} />
              )}
              {item.name}
              {item.value !== null && item.value !== undefined && <b style={{ color: palette.number }}>{Number(item.value).toLocaleString("en-US")}</b>}
            </button>
          ))}
          {list.length > PREVIEW && (
            <button type="button" className="dcs-map-legend-more" style={{ color: palette.number }} onClick={() => setOpen(!open)}>
              {open ? translate("DCS_DB_SHOW_LESS") : translate("DCS_DB_SHOW_MORE", { count: list.length - PREVIEW })}
            </button>
          )}
        </div>
      )}
      {missing > 0 && (
        <p className="dcs-map-missing" style={{ color: palette.muted }}>
          {translate("DCS_DB_MAP_UNKNOWN", { count: missing })}
        </p>
      )}
    </div>
  );
}
