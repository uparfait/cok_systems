import { dcs_request } from "./dcsApiClient.js";

/**
 * Lists top-level departments (read-only, sourced from the main system).
 */
export function list_departments() {
  return dcs_request("/departments", "GET");
}

/**
 * Lists the units belonging to a department.
 */
export function list_department_units(department_id) {
  return dcs_request(`/departments/${department_id}/units`, "GET");
}
