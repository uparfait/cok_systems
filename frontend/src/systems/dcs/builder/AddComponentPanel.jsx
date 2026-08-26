import React, { useState, useEffect } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { DCS_FIELD_TYPE_REGISTRY } from "../fields/fieldTypes.js";
import { get_templates, get_template } from "../services/templatesService.js";
import { clone_selected_fields } from "../jsonlogic/resolveTemplates.js";
import DcsFieldIcon from "../components/DcsFieldIcon.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import TemplateFieldPickerOverlay from "./TemplateFieldPickerOverlay.jsx";

/**
 * The "Choose a component to add" picker: a scrollable list of every
 * form-design and data-collection component, opened as a fixed panel
 * anchored to the top of the viewport so it is always fully visible
 * without scrolling the page. Defaults to its own "+" trigger button, but
 * any caller needing a differently-styled (or multiple) trigger - e.g. a
 * group's own "Add field" button - can pass renderTrigger instead and get
 * the exact same overlay/picker behavior. initialOpen lets a caller start
 * it already open (e.g. a just-created, still-empty group). When
 * onInsertTemplate is provided, a Fields/Templates toggle appears at the
 * top: Fields is this same content/data list, Templates lists every saved
 * template - picking one opens TemplateFieldPickerOverlay to choose which
 * of its fields to bring in and whether to add or overwrite.
 */
export default function AddComponentPanel({ onSelect, onInsertTemplate, renderTrigger, initialOpen }) {
  const { translate } = useDcsLanguage();
  const [is_open, setIsOpen] = useState(!!initialOpen);
  const [active_tab, setActiveTab] = useState("fields");
  const [templates, setTemplates] = useState([]);
  const [templates_loading, setTemplatesLoading] = useState(false);
  const [opening_template, setOpeningTemplate] = useState(null);
  const [picker_template, setPickerTemplate] = useState(null);

  const content_types = DCS_FIELD_TYPE_REGISTRY.filter((entry) => entry.category === "content");
  const data_types = DCS_FIELD_TYPE_REGISTRY.filter((entry) => entry.category === "data");

  // silent (the 10s background refresh) never touches templates_loading, so
  // it can never re-show the "Loading templates..." placeholder over an
  // already-populated list - only the initial open, or an explicit click
  // on "Reload", does that.
  const load_templates = (options) => {
    const is_silent = !!(options && options.silent);
    if (!is_silent) setTemplatesLoading(true);
    get_templates()
      .then((response) => setTemplates(response.data || []))
      .catch(() => setTemplates([]))
      .finally(() => {
        if (!is_silent) setTemplatesLoading(false);
      });
  };

  const supports_templates = !!onInsertTemplate;

  // Deliberately keyed only on is_open/supports_templates, NOT on
  // onInsertTemplate itself - a caller (e.g. FormBuilderCanvas) that
  // defines that callback inline gets a brand new function reference on
  // every one of its own re-renders (every keystroke anywhere on the
  // canvas), and depending on it here would tear down and rebuild this
  // effect just as often - refetching non-silently every time instead of
  // only on open and every 10s. handle_confirm_template_fields below still
  // always calls whatever onInsertTemplate the latest render passed in.
  useEffect(() => {
    if (!is_open || !supports_templates) return;
    load_templates();
    const interval_id = window.setInterval(() => load_templates({ silent: true }), 10000);
    return () => window.clearInterval(interval_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is_open, supports_templates]);

  const handle_select = (field_type) => {
    setIsOpen(false);
    onSelect(field_type);
  };

  const handle_pick_template = async (template_summary) => {
    setOpeningTemplate(template_summary._id);
    try {
      const response = await get_template(template_summary._id);
      setPickerTemplate(response.data);
    } finally {
      setOpeningTemplate(null);
    }
  };

  const handle_confirm_template_fields = (selected_fields, mode) => {
    const cloned_fields = clone_selected_fields(picker_template.fields, selected_fields, picker_template._id);
    setPickerTemplate(null);
    setIsOpen(false);
    onInsertTemplate(cloned_fields, mode);
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
    <>
      {renderTrigger ? (
        renderTrigger(() => setIsOpen(true))
      ) : (
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
        </div>
      )}

      {is_open && (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center pt-10 px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />
          <div
            className="relative bg-white border-2 w-full flex flex-col"
            style={{ borderColor: "#E0E0E0", minWidth: "50vw", maxWidth: 900, maxHeight: "80vh" }}
          >
            <div className="flex items-center justify-between px-3 py-3 border-b flex-shrink-0" style={{ borderColor: "#E0E0E0" }}>
              <p className="text-sm font-semibold" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
                {translate("DCS_PICKER_TITLE")}
              </p>
              <DcsButtonOutline onClick={() => setIsOpen(false)}>{translate("DCS_BTN_CLOSE")}</DcsButtonOutline>
            </div>

            {onInsertTemplate && (
              <div className="flex border-b flex-shrink-0" style={{ borderColor: "#E0E0E0" }}>
                {[
                  { key: "fields", label: translate("DCS_BTN_FIELDS") },
                  { key: "templates", label: translate("DCS_PICKER_CATEGORY_TEMPLATES") },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className="flex-1 cursor-pointer text-xs font-semibold uppercase py-2"
                    style={{
                      color: active_tab === tab.key ? "#056daa" : "#9E9E9E",
                      fontFamily: "'Montserrat', sans-serif",
                      letterSpacing: "0.5px",
                      borderBottom: active_tab === tab.key ? "2px solid #056daa" : "2px solid transparent",
                      backgroundColor: "transparent",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            <div className="overflow-y-auto flex-1">
              {(!onInsertTemplate || active_tab === "fields") && (
                <>
                  {render_group("DCS_PICKER_CATEGORY_CONTENT", content_types)}
                  {render_group("DCS_PICKER_CATEGORY_DATA", data_types)}
                </>
              )}

              {onInsertTemplate && active_tab === "templates" && (
                <div className="mb-3">
                  <div className="flex items-center justify-end px-3 pt-2">
                    <button
                      type="button"
                      onClick={load_templates}
                      disabled={templates_loading}
                      className="text-xs cursor-pointer underline"
                      style={{ color: "#056daa", background: "none", border: "none", opacity: templates_loading ? 0.6 : 1 }}
                    >
                      {translate(templates_loading ? "DCS_TEMPLATES_LOADING" : "DCS_BTN_RELOAD")}
                    </button>
                  </div>
                  {templates_loading ? (
                    <p className="text-xs py-6 text-center" style={{ color: "#9E9E9E" }}>
                      {translate("DCS_TEMPLATES_LOADING")}
                    </p>
                  ) : templates.length === 0 ? (
                    <p className="text-xs py-6 text-center" style={{ color: "#9E9E9E" }}>
                      {translate("DCS_TEMPLATES_LIST_EMPTY")}
                    </p>
                  ) : (
                    templates.map((template_summary) => {
                      const is_loading_this_one = opening_template === template_summary._id;
                      return (
                        <button
                          key={template_summary._id}
                          type="button"
                          onClick={() => handle_pick_template(template_summary)}
                          disabled={!!opening_template}
                          className="dcs-template-picker-row w-full cursor-pointer flex items-center justify-between gap-3 px-3 py-3 text-left border-b"
                          style={{ borderColor: "#E0E0E0", opacity: opening_template && !is_loading_this_one ? 0.5 : 1 }}
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold" style={{ color: "#056daa" }}>
                              {template_summary.name}
                            </span>
                            {template_summary.description && (
                              <span className="block text-xs mt-0.5 truncate" style={{ color: "#9E9E9E" }}>
                                {template_summary.description}
                              </span>
                            )}
                          </span>
                          {is_loading_this_one && (
                            <span
                              className="flex-shrink-0"
                              style={{
                                width: 16,
                                height: 16,
                                borderRadius: "50%",
                                border: "2px solid #E0E0E0",
                                borderTopColor: "#056daa",
                                animation: "dcs-template-spin 0.7s linear infinite",
                              }}
                            />
                          )}
                        </button>
                      );
                    })
                  )}
                  <style>{`
                    .dcs-template-picker-row:hover { background-color: rgba(5,109,170,0.06); }
                    @keyframes dcs-template-spin { to { transform: rotate(360deg); } }
                  `}</style>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {picker_template && (
        <TemplateFieldPickerOverlay
          template={picker_template}
          onClose={() => setPickerTemplate(null)}
          onConfirm={handle_confirm_template_fields}
        />
      )}
    </>
  );
}
