import { useCallback } from "react";
import { get_cached_field_options } from "../services/lazyOptionsCache.js";

/**
 * Builds the two callbacks every page that can encounter a lazy_options
 * field needs (see dc_backend/jsonlogic/lazy_options.js), both backed by
 * the same session cache (lazyOptionsCache.js) so asking twice for the
 * exact same slice never fires a second request:
 * - resolveFieldOptions(field, parent_value) - the flat options array for
 *   whatever the field's live renderer currently needs (only the one
 *   matching branch of a huge cascade), passed to RendererEngine.
 * - resolveFullFieldOptions(field_id) - the field's complete, real data
 *   ({options} or {parent_option_groups}), fetched only once an author
 *   opens that field's own settings in the builder.
 * fetch_field_options is whichever service call matches this page's scope
 * (get_form_field_options, get_template_field_options or
 * get_public_form_field_options) - always called as
 * fetch_field_options(scope_id, field_id, parent_value).
 */
export function useLazyFieldResolvers(scope_type, scope_id, fetch_field_options) {
  const resolveFieldOptions = useCallback(
    (field, parent_value) =>
      get_cached_field_options(scope_type, scope_id, field.id, parent_value, () =>
        fetch_field_options(scope_id, field.id, parent_value).then((response) => response.data.options || []),
      ),
    [scope_type, scope_id, fetch_field_options],
  );

  const resolveFullFieldOptions = useCallback(
    (field_id) =>
      get_cached_field_options(scope_type, scope_id, field_id, undefined, () =>
        fetch_field_options(scope_id, field_id, undefined).then((response) => response.data),
      ),
    [scope_type, scope_id, fetch_field_options],
  );

  return { resolveFieldOptions, resolveFullFieldOptions };
}
