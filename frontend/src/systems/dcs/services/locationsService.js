import { dcs_request } from "./dcsApiClient.js";

/** One administrative level's locations, optionally narrowed to a parent - feeds the approver cascading dropdowns. */
export function get_locations(type, parent_id) {
  const params = new URLSearchParams({ type });
  if (parent_id !== undefined && parent_id !== null) params.set("parent_id", parent_id);
  return dcs_request(`/locations?${params.toString()}`, "GET");
}
