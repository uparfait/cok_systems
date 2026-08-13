import { dcs_request } from "./dcsApiClient.js";

/**
 * Lists every data collection project.
 */
export function list_projects() {
  return dcs_request("/projects", "GET");
}

/**
 * Creates a new project.
 */
export function create_project(project_data) {
  return dcs_request("/projects", "POST", project_data);
}

/**
 * Fetches a single project's details.
 */
export function get_project(project_id) {
  return dcs_request(`/projects/${project_id}`, "GET");
}

/**
 * Updates a project's details.
 */
export function update_project(project_id, updates) {
  return dcs_request(`/projects/${project_id}`, "PUT", updates);
}

/**
 * Permanently deletes a project along with every form and every submission
 * collected under it. Irreversible.
 */
export function delete_project(project_id) {
  return dcs_request(`/projects/${project_id}`, "DELETE");
}
