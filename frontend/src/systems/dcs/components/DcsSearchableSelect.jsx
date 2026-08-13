import React, { useState, useEffect, useRef } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

/**
 * Searchable single-select with a "Change" chip once a value is picked,
 * matching the department/unit assignment pattern used elsewhere in the app.
 */
export default function DcsSearchableSelect({ options, value, onChange, placeholder, disabled, loading, allowClear }) {
  const { translate } = useDcsLanguage();
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handle_click_outside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handle_click_outside);
    return () => document.removeEventListener("mousedown", handle_click_outside);
  }, []);

  const selected_option = (options || []).find((option) => option.id === value);
  const filtered_options = (options || []).filter((option) =>
    option.name.toLowerCase().includes(search.toLowerCase()),
  );

  const open_search = () => {
    if (disabled) return;
    setSearch("");
    setIsOpen(true);
  };

  const handle_select = (selected_id) => {
    onChange(selected_id);
    setSearch("");
    setIsOpen(false);
  };

  if (selected_option && !isOpen) {
    return (
      <div
        className="cok-auth-input border-2 flex items-center justify-between gap-2"
        style={{ borderColor: "#E0E0E0" }}
      >
        <span className="text-sm font-medium truncate" style={{ color: "#333333" }} title={selected_option.name}>
          {selected_option.name}
        </span>
        <button
          type="button"
          onClick={open_search}
          disabled={disabled}
          className="text-xs font-semibold uppercase flex-shrink-0"
          style={{ color: "#056daa", fontFamily: "'Montserrat', sans-serif" }}
        >
          {translate("DCS_BTN_CHANGE")}
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setIsOpen(true);
        }}
        onFocus={open_search}
        disabled={disabled}
        className="cok-auth-input w-full py-3"
        placeholder={placeholder}
      />
      {loading && (
        <div className="absolute right-2 top-1/2" style={{ transform: "translateY(-50%)" }}>
          <SpiralLoader />
        </div>
      )}
      {isOpen && !disabled && (
        <div
          className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto bg-white border-2"
          style={{ borderColor: "#E0E0E0" }}
        >
          {allowClear && (
            <div
              onClick={() => handle_select("")}
              className="px-3 py-2 cursor-pointer text-sm"
              style={{ color: !value ? "#056daa" : "#333333", fontWeight: !value ? 600 : 400 }}
            >
              {translate("DCS_SEARCH_NONE_OPTION")}
            </div>
          )}
          {filtered_options.length === 0 ? (
            <div className="px-3 py-2 text-sm" style={{ color: "#9E9E9E" }}>
              {translate("DCS_SEARCH_NO_RESULTS")}
            </div>
          ) : (
            filtered_options.map((option) => (
              <div
                key={option.id}
                onClick={() => handle_select(option.id)}
                className="px-3 py-2 cursor-pointer text-sm"
                style={{ color: option.id === value ? "#056daa" : "#333333", fontWeight: option.id === value ? 600 : 400 }}
                title={option.name}
              >
                {option.name}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
