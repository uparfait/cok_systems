import { useCallback, useRef, useState } from "react";

export function useFollowUpMode({ tracked, values, applyValues }) {
  const [enabled, setEnabled] = useState(false);
  const other_values_ref = useRef({});

  const set_mode = useCallback(
    (next) => {
      const wanted = !!next;
      if (wanted === enabled) return;
      const incoming = other_values_ref.current;
      other_values_ref.current = values || {};
      setEnabled(wanted);
      applyValues(incoming);
    },
    [enabled, values, applyValues],
  );

  return { enabled: tracked && enabled, set_mode };
}
