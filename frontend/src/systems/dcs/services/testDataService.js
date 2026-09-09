import { dcs_request } from "./dcsApiClient.js";

export function generate_test_data(form_group_id, payload) {
  return dcs_request(`/test-data/${form_group_id}/generate`, "POST", payload);
}

export function get_test_data_job(job_id, known_percent) {
  const query = known_percent === undefined || known_percent === null ? "" : `?known_percent=${encodeURIComponent(known_percent)}`;
  return dcs_request(`/test-data/jobs/${job_id}${query}`, "GET");
}

export function delete_test_data(form_group_id, payload) {
  return dcs_request(`/test-data/${form_group_id}`, "DELETE", payload);
}

export function generate_test_approvals(form_group_id, payload) {
  return dcs_request(`/test-data/${form_group_id}/approvals`, "POST", payload);
}

export function clear_test_approvals(form_group_id) {
  return dcs_request(`/test-data/${form_group_id}/approvals`, "DELETE");
}
