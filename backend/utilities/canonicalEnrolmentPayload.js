// Deterministic bytes a staff member signs to prove they hold the certificate they are enrolling.
// MUST stay byte-for-byte identical to frontend/src/core/utils/canonicalEnrolmentPayload.js
const ENROLMENT_PURPOSE = 'enrol-signing-certificate';

const ENROLMENT_FIELD_ORDER = ['purpose', 'userId', 'email', 'signedAt'];

// NFC so the same text always encodes the same way
function normalizeValue(value) {
  return String(value === undefined || value === null ? '' : value).normalize('NFC').trim();
}

// Length-prefixed so a value containing a newline or colon cannot shift later fields
function buildEnrolmentPayload(fields) {
  return ENROLMENT_FIELD_ORDER.map((name) => {
    const value = normalizeValue(fields[name]);
    return `${name}:${Buffer.byteLength(value, 'utf8')}:${value}`;
  }).join('\n');
}

module.exports = { ENROLMENT_PURPOSE, ENROLMENT_FIELD_ORDER, buildEnrolmentPayload, normalizeValue };
