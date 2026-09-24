const forms_model = require("../../models/forms_model.js");
const media_model = require("../../models/submission_media_model.js");
const project_access = require("../../utilities/project_access.js");
const { flatten_fields } = require("../../jsonlogic/dependency_graph.js");
const { resolve_period_bounds } = require("../../utilities/period_bounds.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 60;
// Every field type whose answer can hold a picture or a video. Audio is
// left out on purpose: the gallery is a grid of things you look at.
const MEDIA_FIELD_TYPES = ["image", "video", "file_upload", "signature"];

/** A field's own question text in the reader's language, English then Kinyarwanda then French as fallbacks. */
function field_label_text(field, language) {
  const label = field.label && typeof field.label === "object" ? field.label : {};
  const text = (language && label[language]) || label.en || label.kn || label.fr || "";
  return String(text).trim();
}

/**
 * Every media field the form has ever had, across all of its versions -
 * a picture collected against version 1 still belongs in the gallery
 * after the field is dropped from version 2. The first version that
 * declares a field owns the label shown under its pictures.
 */
function collect_media_fields(versions, language) {
  const by_id = new Map();
  (versions || []).forEach((version_document) => {
    flatten_fields((version_document.schema && version_document.schema.fields) || []).forEach((field) => {
      if (!MEDIA_FIELD_TYPES.includes(field.type) || by_id.has(field.id)) return;
      by_id.set(field.id, { field_id: field.id, type: field.type, label: field_label_text(field, language) });
    });
  });
  return Array.from(by_id.values());
}

function parse_filters(raw) {
  if (!raw) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    return null;
  }
}

/**
 * One page of a form's collected pictures and videos, newest first - what
 * the Data area's Gallery scrolls through. Paged over the media answers
 * themselves, not over records, so every page is a full grid.
 */
async function get_submission_media(req, res) {
  try {
    const { form_group_id } = req.params;
    const { page = 1, limit = DEFAULT_PAGE_SIZE, period = "all", from, to, filters } = req.query || {};

    if (!form_group_id) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    const access = await project_access.can_view_form_group(req.user, form_group_id);
    if (!access.found) return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    if (!access.allowed) return res.status(403).json(warning_response(req, "ACCESS_DENIED"));

    const bounds = resolve_period_bounds(period, from, to);
    if (bounds === undefined) {
      return res.status(400).json(warning_response(req, "VALIDATION_FAILED"));
    }

    const versions = await forms_model.get_versions_by_group(form_group_id);
    const media_fields = collect_media_fields(versions, req.language);

    const page_number = Math.max(1, parseInt(page, 10) || 1);
    const page_size = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(limit, 10) || DEFAULT_PAGE_SIZE));

    const result = await media_model.list_media_answers(
      form_group_id,
      media_fields.map((field) => field.field_id),
      (page_number - 1) * page_size,
      page_size,
      bounds,
      parse_filters(filters),
    );

    const label_by_field = new Map(media_fields.map((field) => [field.field_id, field.label]));
    const items = result.items.map((item) =>
      Object.assign({}, item, { field_label: label_by_field.get(item.field_id) || "" }),
    );

    return res.status(200).json(
      Object.assign(success_response(req, "SUBMISSIONS_FETCHED", items), {
        total: result.total,
        page: page_number,
        limit: page_size,
        has_more: page_number * page_size < result.total,
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_submission_media;
