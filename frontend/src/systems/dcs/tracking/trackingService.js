import { dcs_request } from "../services/dcsApiClient.js";

/**
 * Public, no-auth lookup of a tracked form's records by their key value:
 * { key, key_field_id, editable_field_ids, records: [...] }, each record
 * with its answers, dates, change history and value periods.
 */
export function search_public_records(form_group_id, key) {
  return dcs_request(`/public/forms/${form_group_id}/records?key=${encodeURIComponent(key)}`, "GET");
}

/**
 * Public, no-auth update of one record: only the updatable fields are
 * read from data; respondent says who made the change.
 */
export function update_public_record(form_group_id, submission_id, data, respondent) {
  return dcs_request(`/public/forms/${form_group_id}/records/${submission_id}`, "PUT", { data, respondent: respondent || null });
}
