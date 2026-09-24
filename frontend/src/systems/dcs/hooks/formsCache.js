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

/**
 * A form's own name, by form_group_id, for the whole life of the page.
 *
 * Every page of a form publishes that form's name to the header and to
 * the workspace panel beside the sidebar, but not every page has the
 * name in hand the moment it mounts - a page that only needs the form's
 * versions, or its media, has to fetch first. Without this, moving
 * between those pages made the name blink away to "..." and come back,
 * even though the form had not changed at all. The last name seen for a
 * form is remembered here and shown while the new page catches up.
 */
const form_names = new Map();

export function remember_form_name(form_group_id, form_name) {
  if (!form_group_id || !form_name) return form_name;
  form_names.set(String(form_group_id), form_name);
  return form_name;
}

export function get_cached_form_name(form_group_id) {
  return form_group_id ? form_names.get(String(form_group_id)) || "" : "";
}
