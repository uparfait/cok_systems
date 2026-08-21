/**
 * Turns the current DCS pathname into a readable route template - real
 * ids (project_id, form_group_id, version) replaced by their param name -
 * instead of a raw path full of opaque database ids. Returns null on the
 * home page itself (/dcs-system), where there is nothing below it to show.
 */
export function build_dcs_breadcrumb_path(pathname) {
  const relative = pathname.replace(/^\/dcs-system\/?/, "");
  if (!relative) return null;

  const segments = relative.split("/").filter(Boolean);

  return segments
    .map((segment, index) => {
      const previous_segment = segments[index - 1];
      if (previous_segment === "project") return "project_id";
      if (previous_segment === "forms" && segment !== "new") return "form_id";
      if (previous_segment !== "forms" && segments[index - 2] === "forms" && /^\d+$/.test(segment)) return "version";
      return segment;
    })
    .join("/");
}
