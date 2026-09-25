// Deterministic byte encoding of the attendance fields that get signed.
// MUST stay byte-for-byte identical to em_backend/utilities/canonicalAttendancePayload.js
const SIGNED_FIELD_ORDER = [
  'eventSpecialId',
  'attendeeFullName',
  'attendeeEmail',
  'attendeePhoneNumber',
  'attendeeInstitution',
  'attendeeDepartment',
  'attendeePosition',
  'signedAt',
];

// NFC so the same name typed with combining accents always encodes the same way
function normalizeValue(value) {
  return String(value === undefined || value === null ? '' : value).normalize('NFC').trim();
}

// Length-prefixed so a value containing a newline or colon cannot shift later fields
export function buildCanonicalPayload(fields) {
  return SIGNED_FIELD_ORDER.map((name) => {
    const value = normalizeValue(fields[name]);
    const byteLength = new TextEncoder().encode(value).length;
    return `${name}:${byteLength}:${value}`;
  }).join('\n');
}

export function canonicalPayloadBytes(fields) {
  return new TextEncoder().encode(buildCanonicalPayload(fields));
}

export { SIGNED_FIELD_ORDER };
