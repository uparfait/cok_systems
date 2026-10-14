const forms_model = require("../../models/forms_model.js");
const follow_up_forms_model = require("../../models/follow_up_forms_model.js");
const submissions_model = require("../../models/submissions_model.js");
const { get_db } = require("../../db_connection/db.js");
const { searchable_fields } = require("./searchable_fields.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const PAGE_SIZE = 20;
const MAX_QUERY_LENGTH = 200;

function escape_regex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The condition one searchable field is matched with: a text answer that
 * CONTAINS the query (case-insensitive, the query taken literally), or a
 * number answer EQUAL to it - whether it was stored as a number or as the
 * digits typed in.
 */
function field_condition(field, query) {
  const path = `data.${field.id}`;
  if (field.type === "number") {
    const number = Number(query);
    if (!Number.isFinite(number)) return null;
    return { [path]: { $in: [number, query, String(number)] } };
  }
  return { [path]: { $regex: escape_regex(query), $options: "i" } };
}

/**
 * Public, no-auth search of the ACTUAL form's records by one searchable
 * field - every version of the form, newest first, twenty per page. This
 * is how a respondent finds the record to load into the follow-up form.
 */
async function search_follow_up_records(req, res) {
  try {
    const { follow_up_group_id } = req.params;
    const field_id = typeof (req.query || {}).field === "string" ? req.query.field.trim() : "";
    const query = typeof (req.query || {}).q === "string" ? req.query.q.trim().slice(0, MAX_QUERY_LENGTH) : "";
    const page = Math.max(1, parseInt((req.query || {}).page, 10) || 1);

    if (!follow_up_group_id) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }
    const active = await follow_up_forms_model.get_active(follow_up_group_id);
    if (!active) {
      return res.status(404).json(warning_response(req, "FORM_PUBLIC_NOT_FOUND"));
    }
    const source = await forms_model.get_active_version(active.source_form_group_id);
    const field = source ? searchable_fields(source.schema, active.schema).find((entry) => entry.id === field_id) : null;
    if (!field || !query) {
      return res.status(400).json(warning_response(req, "FOLLOW_UP_SEARCH_INVALID"));
    }
    const condition = field_condition(field, query);
    if (!condition) {
      return res.status(200).json(success_response(req, "SUBMISSIONS_FETCHED", { items: [], page, pages: 0, total: 0 }));
    }

    const filter = Object.assign({ form_group_id: active.source_form_group_id }, condition);
    const collection = get_db().collection("dcs_submissions");
    const [items, total] = await Promise.all([
      collection
        .find(filter, { projection: { _id: 1, submitted_at: 1, data: 1 } })
        .sort({ submitted_at: -1, _id: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .toArray(),
      collection.countDocuments(filter),
    ]);
    items.forEach((item) => {
      delete item[submissions_model.TEST_DATA_FLAG];
    });

    return res.status(200).json(
      success_response(req, "SUBMISSIONS_FETCHED", { items, page, pages: Math.ceil(total / PAGE_SIZE), total }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = search_follow_up_records;
