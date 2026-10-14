const follow_up_submissions_model = require("../../models/follow_up_submissions_model.js");
const { existing_viewer_context } = require("./context.js");
const { collect_media_fields, parse_filters, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } = require("../submissions/get_submission_media.js");
const { resolve_period_bounds } = require("../../utilities/period_bounds.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * One page of the follow-up's own pictures and videos, newest first - the
 * follow-up page's Gallery tab. Same shape as the form's gallery; every
 * item carries source "follow_up" and the follow_up_group_id.
 */
async function get_follow_up_media(req, res) {
  try {
    const context = await existing_viewer_context(req, res);
    if (!context) return undefined;
    const { page = 1, limit = DEFAULT_PAGE_SIZE, period = "all", from, to, filters } = req.query || {};

    const bounds = resolve_period_bounds(period, from, to);
    if (bounds === undefined) {
      return res.status(400).json(warning_response(req, "VALIDATION_FAILED"));
    }

    const media_fields = collect_media_fields(context.versions, req.language);
    const page_number = Math.max(1, parseInt(page, 10) || 1);
    const page_size = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(limit, 10) || DEFAULT_PAGE_SIZE));

    const result = await follow_up_submissions_model.list_media(
      context.follow_up_group_id,
      media_fields.map((field) => field.field_id),
      (page_number - 1) * page_size,
      page_size,
      bounds,
      parse_filters(filters),
    );

    const label_by_field = new Map(media_fields.map((field) => [field.field_id, field.label]));
    const items = result.items.map((item) =>
      Object.assign({}, item, { field_label: label_by_field.get(item.field_id) || "", follow_up_group_id: item.follow_up_group_id || context.follow_up_group_id }),
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

module.exports = get_follow_up_media;
