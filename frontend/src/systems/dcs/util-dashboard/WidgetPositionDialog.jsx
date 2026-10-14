import React, { useCallback, useEffect, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsCenterOverlay from "../components/DcsCenterOverlay.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import { position_of, clamp_position } from "./boardOrder.js";

const FONT = "'Montserrat', sans-serif";

export default function WidgetPositionDialog({ widget, widgets, layout, saving, onSave, onClose }) {
  const { translate } = useDcsLanguage();
  const { index, count } = position_of(widgets, layout, widget);
  const current = index + 1;
  const [value, setValue] = useState(String(current || 1));

  useEffect(() => {
    const key = (event) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [saving, onClose]);

  const submit = (event) => {
    if (event) event.preventDefault();
    if (saving || count < 1) return;
    onSave(clamp_position(value, count));
  };

  return (
    <DcsCenterOverlay title={translate("DCS_DB_POSITION_TITLE")} onClose={onClose} onBackdrop={onClose} busy={saving} maxWidth={400}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-sm" style={{ color: "#333333", fontFamily: FONT, margin: 0 }}>
          {translate("DCS_DB_POSITION_COUNT", { count })}
        </p>
        <p className="text-sm font-semibold" style={{ color: "#056daa", fontFamily: FONT, margin: 0 }}>
          {translate("DCS_DB_POSITION_CURRENT", { position: current })}
        </p>
        <div>
          <label className="cok-auth-label" htmlFor="dcs-widget-position">
            {translate("DCS_DB_POSITION_LABEL", { count })}
          </label>
          <input
            id="dcs-widget-position"
            type="number"
            className="cok-auth-input"
            min={1}
            max={count}
            step={1}
            value={value}
            disabled={saving}
            autoFocus
            onChange={(event) => setValue(event.target.value)}
            onBlur={() => setValue(String(clamp_position(value, count)))}
          />
        </div>
        <div className="flex justify-end">
          <DcsButtonPrimary type="submit" disabled={saving || count < 1}>
            {translate("DCS_DB_POSITION_SAVE")}
          </DcsButtonPrimary>
        </div>
      </form>
    </DcsCenterOverlay>
  );
}

export function useWidgetPosition({ widgets, layout, onMove }) {
  const [target, setTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const open = useCallback((widget) => setTarget(widget || null), []);
  const close = useCallback(() => setTarget(null), []);

  const save = async (position) => {
    if (!target) return;
    setSaving(true);
    try {
      const result = await onMove(target, position);
      if (result && result.ok) setTarget(null);
    } finally {
      setSaving(false);
    }
  };

  const shown = target ? widgets.find((widget) => widget.id === target.id) || null : null;
  const element = shown ? <WidgetPositionDialog key={shown.id} widget={shown} widgets={widgets} layout={layout} saving={saving} onSave={save} onClose={close} /> : null;
  return { open, element };
}
