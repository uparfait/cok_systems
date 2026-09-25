// Deterministic byte encoding of the attendance fields that get signed.
// MUST stay byte-for-byte identical to frontend/src/systems/event-managment/utils/canonicalAttendancePayload.js
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
function buildCanonicalPayload(fields) {
  return SIGNED_FIELD_ORDER.map((name) => {
    const value = normalizeValue(fields[name]);
    return `${name}:${Buffer.byteLength(value, 'utf8')}:${value}`;
  }).join('\n');
}

module.exports = { SIGNED_FIELD_ORDER, buildCanonicalPayload, normalizeValue };
