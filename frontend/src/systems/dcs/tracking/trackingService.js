import { dcs_request } from "../services/dcsApiClient.js";

export function search_public_records(form_group_id, { field, key, page, limit }) {
  const params = new URLSearchParams();
  if (field) params.set("field", field);
  params.set("key", key === undefined || key === null ? "" : String(key));
  params.set("page", String(page || 1));
  params.set("limit", String(limit || 20));
  return dcs_request(`/public/forms/${form_group_id}/records?${params.toString()}`, "GET");
}

export function update_public_record(form_group_id, submission_id, data, respondent) {
  return dcs_request(`/public/forms/${form_group_id}/records/${submission_id}`, "PUT", { data, respondent: respondent || null });
}
