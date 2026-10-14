/**
 * The IANA time zone the viewer's browser runs in ("Africa/Kigali"), sent
 * as `tz` with every request that carries a period, so the server reads
 * "today" and a typed 16:46 in the viewer's zone rather than its own.
 * Falls back to UTC where the browser cannot say.
 */
export function viewer_zone() {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof zone === "string" && zone ? zone : "UTC";
  } catch (error) {
    return "UTC";
  }
}

/** A request body with the viewer's zone written onto it. */
export const with_zone = (body) => Object.assign({}, body || {}, { tz: viewer_zone() });
