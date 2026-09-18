/**
 * The forms of each project, as last fetched, kept for the life of the page.
 *
 * A project's forms are asked for from several places - the sidebar row
 * each time it is opened, the project page, the forms list - and every one
 * of them used to start from nothing: a skeleton, a request, then the same
 * list again. What was already on screen a moment ago is shown at once
 * instead, and the fresh copy arrives silently behind it. Nothing here is
 * ever trusted over the server: it is only what to show while asking.
 */
const forms_by_project = new Map();

export function get_cached_forms(project_id) {
  return project_id ? forms_by_project.get(String(project_id)) || null : null;
}

export function remember_forms(project_id, forms) {
  if (!project_id || !Array.isArray(forms)) return forms;
  forms_by_project.set(String(project_id), forms);
  return forms;
}
