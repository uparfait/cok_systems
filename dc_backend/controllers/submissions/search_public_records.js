const forms_model = require("../../models/forms_model.js");
const tracked_records_model = require("../../models/tracked_records_model.js");
const { is_enabled, key_ids_of, record_key_of } = require("../../utilities/tracking.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = tracked_records_model.MAX_MATCHES;

/**
 * Public, no-auth SEARCH of a tracked form's records by key value: the
 * respondent types a value (?key=) and every record whose key value
 * CONTAINS it on ANY of the form's key fields comes back, a page at a
 * time (?page, ?limit up to 50), closest first - exact matches, then
 * values starting with it, then the rest, newest first within each group
 * - each with its answers, its dates and its whole change history.
 * Several key fields never mean a record must match on all of them.
 * ?field=<key field id> optionally narrows the search to one key field.
 * The value is normalised exactly like the stored key (trimmed,
 * lowercased, numbers canonical), so "Pio" finds "pio" and "12.0" finds
 * 12 (and 120, which contains it). Anyone with the form link may
 * search, exactly as anyone may fill the form in.
 *
 * 200 { key, field_id, key_field_ids, editable_field_ids, records, page,
 * pages, total }; 400 TRACKING_KEY_REQUIRED when no value was typed or
 * ?field is not one of the key fields; 400 TRACKING_NOT_ENABLED.
 */
async function search_public_records(req, res) {
  try {
    const { form_group_id } = req.params;
    const query = req.query || {};
    const key = record_key_of(query.key);
    const field_id = typeof query.field === "string" && query.field.trim() ? query.field.trim() : null;
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(query.limit, 10) || DEFAULT_PAGE_SIZE));

    if (!form_group_id) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }
    if (!key) {
      return res.status(400).json(warning_response(req, "TRACKING_KEY_REQUIRED"));
    }

    const active_form = await forms_model.get_active_version(form_group_id);
    if (!active_form) {
      return res.status(404).json(warning_response(req, "FORM_PUBLIC_NOT_FOUND"));
    }
    const tracking = active_form.tracking;
    if (!is_enabled(tracking)) {
      return res.status(400).json(warning_response(req, "TRACKING_NOT_ENABLED"));
    }
    const key_field_ids = key_ids_of(tracking);
    if (field_id && !key_field_ids.includes(field_id)) {
      return res.status(400).json(
        warning_response(req, "TRACKING_KEY_REQUIRED", null, {
          detail: `field must be one of the key fields: ${key_field_ids.join(", ")}`,
          key_field_ids,
        }),
      );
    }

    // Legacy rows carry record_key alone; its value is the first key's,
    // so the whole-key fallback applies unless another key was named.
    const with_record_key = !field_id || field_id === key_field_ids[0];
    const read = () => tracked_records_model.list_by_key_pair(form_group_id, field_id || key_field_ids, key, page, limit, with_record_key);
    let result = await read();

    // A legacy row met here (or nothing found at all) brings the form's
    // records up to the current key fields now - their keys and pairs
    // rebuilt from their answers, only the records not yet current - so
    // the pairs index answers from the next lookup on; when the first
    // read came back empty, it is read again over the stamped records.
    const met_legacy = result.items.some((record) => !Array.isArray(record.record_key_pairs));
    if (met_legacy || result.total === 0) {
      const stamped = await tracked_records_model.backfill_form_key_pairs(form_group_id, tracking);
      if (stamped > 0 && result.total === 0) result = await read();
    }

    // Still nothing: the lookup never answers empty for data that exists.
    // The key fields' own answers are read directly (exact, whatever the
    // letter case or surrounding spaces), and what that finds is
    // re-stamped from its answers so the next lookup rides the index.
    if (result.total === 0) {
      result = await tracked_records_model.list_by_data_value(form_group_id, field_id || key_field_ids, key, page, limit);
      if (result.items.length > 0) await tracked_records_model.stamp_records_from_data(tracking, result.items.map((record) => record._id));
    }

    const pages = Math.max(1, Math.ceil(result.total / limit));
    return res.status(200).json(
      success_response(req, "TRACKING_RECORDS_FETCHED", {
        key,
        field_id,
        key_field_ids,
        editable_field_ids: tracking.editable_field_ids || [],
        records: result.items.map((record) => tracked_records_model.to_public_record(record)),
        page,
        pages,
        total: result.total,
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = search_public_records;
