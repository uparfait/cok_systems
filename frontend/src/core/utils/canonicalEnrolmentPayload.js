// Deterministic bytes a staff member signs to prove they hold the certificate they are enrolling.
// MUST stay byte-for-byte identical to backend/utilities/canonicalEnrolmentPayload.js
export const ENROLMENT_PURPOSE = 'enrol-signing-certificate';

const ENROLMENT_FIELD_ORDER = ['purpose', 'userId', 'email', 'signedAt'];

// NFC so the same text always encodes the same way
function normalizeValue(value) {
  return String(value === undefined || value === null ? '' : value).normalize('NFC').trim();
}

// Length-prefixed so a value containing a newline or colon cannot shift later fields
export function buildEnrolmentPayload(fields) {
  return ENROLMENT_FIELD_ORDER.map((name) => {
    const value = normalizeValue(fields[name]);
    const byteLength = new TextEncoder().encode(value).length;
    return `${name}:${byteLength}:${value}`;
  }).join('\n');
}

export function enrolmentPayloadBytes(fields) {
  return new TextEncoder().encode(buildEnrolmentPayload(fields));
}
