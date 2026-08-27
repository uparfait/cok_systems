import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { get_templates, get_template, get_template_field_options } from "../services/templatesService.js";
import { useLazyFieldResolvers } from "../hooks/useLazyFieldResolvers.js";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsEmptyState from "../components/DcsEmptyState.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";
import ReviewOverlay from "../renderer/ReviewOverlay.jsx";

/**
 * Lists every saved field template - name and description only. Clicking a
 * template's own name opens its edit page; "Review" opens a read-only
 * rehearsal of it (the exact page a respondent would see, via
 * RendererEngine) without leaving the list. Templates are a global
 * library, not scoped to any project.
 */
export default function TemplatesListPage() {
  const { translate } = useDcsLanguage();
  const { showError } = useToast();
  const navigate = useNavigate();

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [opening_id, setOpeningId] = useState(null);
  const [reviewing_schema, setReviewingSchema] = useState(null);
  const [reviewing_template_id, setReviewingTemplateId] = useState(null);
  const { resolveFieldOptions } = useLazyFieldResolvers("template", reviewing_template_id, get_template_field_options);

  const refresh = () => {
    setLoading(true);
    get_templates()
      .then((response) => setTemplates(response.data || []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  const handle_review = async (template_summary) => {
    setOpeningId(template_summary._id);
    try {
      const response = await get_template(template_summary._id);
      setReviewingTemplateId(template_summary._id);
      setReviewingSchema({ fields: response.data.fields || [] });
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setOpeningId(null);
    }
  };

  const is_empty = !loading && templates.length === 0;

  return (
    <div className="w-full min-[760px]:w-[80vw] mx-auto pb-16 space-y-4">
      <div className={is_empty ? "flex justify-center" : "flex justify-end"}>
        <DcsButtonPrimary
          className="w-full sm:w-auto"
          style={is_empty ? { padding: "1.2rem 2rem", fontSize: 14 } : { maxHeight: "300px" }}
          onClick={() => navigate("/dcs-system/templates/new")}
        >
          {translate("DCS_BTN_NEW_TEMPLATE")}
        </DcsButtonPrimary>
      </div>

      {loading && <SpiralLoader />}
      {is_empty && <DcsEmptyState messageKey="DCS_TEMPLATES_LIST_EMPTY" />}

      <div className="space-y-2">
        {templates.map((template) => (
          <div
            key={template._id}
            className="bg-white border-2 p-3 sm:p-4 flex items-center justify-between gap-3 flex-wrap"
            style={{ borderColor: "#E0E0E0" }}
          >
            <a
              href={`/dcs-system/templates/${template._id}/edit`}
              onClick={(event) => {
                event.preventDefault();
                navigate(`/dcs-system/templates/${template._id}/edit`);
              }}
              className="min-w-0 flex-1 hover:underline"
            >
              <p className="text-sm font-semibold truncate" style={{ color: "#056daa", fontFamily: "'Montserrat', sans-serif" }}>
                {template.name}
              </p>
              {template.description && (
                <p className="text-xs truncate" style={{ color: "#9E9E9E" }}>
                  {template.description}
                </p>
              )}
            </a>
            <DcsButtonOutline
              disabled={opening_id === template._id}
              onClick={() => handle_review(template)}
            >
              {opening_id === template._id ? translate("DCS_TEMPLATES_LOADING") : translate("DCS_BTN_REVIEW")}
            </DcsButtonOutline>
          </div>
        ))}
      </div>

      {reviewing_schema && (
        <ReviewOverlay
          schema={reviewing_schema}
          resolveFieldOptions={resolveFieldOptions}
          onClose={() => {
            setReviewingSchema(null);
            setReviewingTemplateId(null);
          }}
        />
      )}
    </div>
  );
}
