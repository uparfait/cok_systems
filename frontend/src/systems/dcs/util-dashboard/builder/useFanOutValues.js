import { useEffect, useState } from "react";
import { resolve_fan_out_values } from "./fieldValues.js";

const IDLE = { loading: false, list: [] };

/**
 * The collected values of the "in each" field, refreshed whenever that
 * field changes: { loading, list }. Nothing is fetched without a field.
 */
export function useFanOutValues(form, field) {
  const [values, setValues] = useState(IDLE);
  const field_id = field ? field.id : "";

  useEffect(() => {
    if (!field) {
      setValues(IDLE);
      return undefined;
    }
    let is_mounted = true;
    setValues({ loading: true, list: [] });
    resolve_fan_out_values(form, field).then((list) => {
      if (is_mounted) setValues({ loading: false, list });
    });
    return () => {
      is_mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field_id, form.form_group_id]);

  return values;
}
