import React, { useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { DCS_FIELD_TYPE_REGISTRY } from "../fields/fieldTypes.js";
import DcsFieldIcon from "../components/DcsFieldIcon.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";

/**
 * The "+" trigger that opens a scrollable picker of every form-design and
 * data-collection component. Opens as a fixed panel anchored to the top of
 * the viewport so it is always fully visible without scrolling the page.
 */
export default function AddComponentPanel({ onSelect }) {
  const { translate } = useDcsLanguage();
  const [is_open, setIsOpen] = useState(false);

  const content_types = DCS_FIELD_TYPE_REGISTRY.filter((entry) => entry.category === "content");
  const data_types = DCS_FIELD_TYPE_REGISTRY.filter((entry) => entry.category === "data");

  const handle_select = (field_type) => {
    setIsOpen(false);
    onSelect(field_type);
  };

  const render_group = (title_key, entries) => (
    <div className="mb-3">
      <p
        className="text-xs font-semibold uppercase px-3 pt-2 pb-1"
        style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.5px" }}
      >
        {translate(title_key)}
      </p>
      {entries.map((entry) => (
        <button
          key={entry.type}
          type="button"
          onClick={() => handle_select(entry.type)}
          className="w-full cursor-pointer flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50"
        >
          <DcsFieldIcon type={entry.type} className="flex-shrink-0" />
          <span>
            <span className="block text-sm font-medium" style={{ color: "#333333" }}>
              {translate(entry.labelKey)}
            </span>
            <span className="block text-xs" style={{ color: "#9E9E9E" }}>
              {translate(entry.descriptionKey)}
            </span>
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="cok-btn-outlined flex items-center justify-center"
        style={{ width: 100, height: 40 }}
        aria-label={translate("DCS_BTN_ADD_COMPONENT")}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {is_open && (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center pt-10 px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />
          <div
            className="relative bg-white border-2 w-full flex flex-col"
            style={{ borderColor: "#E0E0E0", maxWidth: 420, maxHeight: "80vh" }}
          >
            <div className="flex items-center justify-between px-3 py-3 border-b flex-shrink-0" style={{ borderColor: "#E0E0E0" }}>
              <p className="text-sm font-semibold" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
                {translate("DCS_PICKER_TITLE")}
              </p>
              <DcsButtonOutline onClick={() => setIsOpen(false)}>{translate("DCS_BTN_CLOSE")}</DcsButtonOutline>
            </div>
            <div className="overflow-y-auto flex-1">
              {render_group("DCS_PICKER_CATEGORY_CONTENT", content_types)}
              {render_group("DCS_PICKER_CATEGORY_DATA", data_types)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
