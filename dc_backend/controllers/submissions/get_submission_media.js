const forms_model = require("../../models/forms_model.js");
const follow_up_forms_model = require("../../models/follow_up_forms_model.js");
const follow_up_submissions_model = require("../../models/follow_up_submissions_model.js");
const media_model = require("../../models/submission_media_model.js");
const project_access = require("../../utilities/project_access.js");
const { flatten_fields } = require("../../jsonlogic/dependency_graph.js");
const { resolve_period_bounds } = require("../../utilities/period_bounds.js");
const { is_enabled: is_tracking_enabled } = require("../../utilities/tracking.js");
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

const field_ids_of = (fields) => fields.map((field) => field.field_id);

/**
 * One page of a form's collected pictures and videos, newest first - what
 * the Data area's Gallery scrolls through. Paged over the media answers
 * themselves, not over records, so every page is a full grid.
 *
 * ?scope=all adds the form's follow-up records (when it has a follow-up)
 * to the same page, ordered together by date; every item then says which
 * source it came from ("form" or "follow_up") and the follow_up_group_id,
 * so a tile opens the right table. The default scope reads the form's own
 * records only, exactly as before.
 */
async function get_submission_media(req, res) {
  try {
    const { form_group_id } = req.params;
    const { page = 1, limit = DEFAULT_PAGE_SIZE, period = "all", from, to, filters, scope } = req.query || {};

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
    // The gallery reads the range the way the table does, so the pictures
    // on screen belong to the very stages the table is listing.
    const active_version = versions.find((entry) => entry.is_active) || versions[0];
    const tracking = active_version && is_tracking_enabled(active_version.tracking) ? active_version.tracking : null;
    const value_filters = parse_filters(filters);

    const sides = [media_model.form_media_side(form_group_id, field_ids_of(media_fields), bounds, value_filters, tracking)];
    let follow_up_fields = [];
    if (scope === "all") {
      const follow_up = await follow_up_forms_model.get_by_group(form_group_id);
      if (follow_up) {
        follow_up_fields = collect_media_fields(await follow_up_forms_model.get_versions(follow_up.follow_up_group_id), req.language);
        sides.push(follow_up_submissions_model.media_side(follow_up.follow_up_group_id, field_ids_of(follow_up_fields), bounds, value_filters));
      }
    }

    const page_number = Math.max(1, parseInt(page, 10) || 1);
    const page_size = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(limit, 10) || DEFAULT_PAGE_SIZE));
    const result = await media_model.list_media(sides, (page_number - 1) * page_size, page_size);

    const labels = {
      form: new Map(media_fields.map((field) => [field.field_id, field.label])),
      follow_up: new Map(follow_up_fields.map((field) => [field.field_id, field.label])),
    };
    const items = result.items.map((item) =>
      Object.assign({}, item, {
        field_label: (labels[item.source] || labels.form).get(item.field_id) || "",
        follow_up_group_id: item.follow_up_group_id || null,
      }),
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
module.exports.collect_media_fields = collect_media_fields;
module.exports.parse_filters = parse_filters;
module.exports.DEFAULT_PAGE_SIZE = DEFAULT_PAGE_SIZE;
module.exports.MAX_PAGE_SIZE = MAX_PAGE_SIZE;
