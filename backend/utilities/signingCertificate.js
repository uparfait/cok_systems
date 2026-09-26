const crypto = require('crypto');
const { buildEnrolmentPayload, normalizeValue, ENROLMENT_PURPOSE } = require('./canonicalEnrolmentPayload');

// Fixed server-side; never taken from anything the client sent
const SIGNATURE_ALGORITHM = 'RSA-SHA256';
const MIN_RSA_MODULUS_BITS = 2048;
const MAX_SIGNATURE_BYTES = 1024;
const MAX_CERTIFICATE_BYTES = 8192;
const MAX_CLOCK_SKEW_MS = 10 * 60 * 1000;

// Extended key usages, by OID and by the names Node may report
const EKU_SERVER_AUTH = ['1.3.6.1.5.5.7.3.1', 'serverAuth', 'TLS Web Server Authentication'];
const EKU_CODE_SIGNING = ['1.3.6.1.5.5.7.3.3', 'codeSigning', 'Code Signing'];
const EKU_PERSON_SIGNING = [
  '1.3.6.1.5.5.7.3.4', 'emailProtection', 'E-mail Protection',
  '1.3.6.1.5.5.7.3.2', 'clientAuth', 'TLS Web Client Authentication',
  '1.3.6.1.4.1.311.10.3.12', '1.2.840.113583.1.1.5',
];

function decodeBase64(value, limitBytes, label) {
  if (typeof value !== 'string' || value.length === 0) return { error: `${label} is missing` };
  const buffer = Buffer.from(value, 'base64');
  if (buffer.length === 0) return { error: `${label} is empty` };
  if (buffer.length > limitBytes) return { error: `${label} is too large` };
  // Buffer.from never throws on bad base64, so confirm it round-trips
  if (buffer.toString('base64').replace(/=+$/, '') !== value.replace(/\s+/g, '').replace(/=+$/, '')) {
    return { error: `${label} is not valid base64` };
  }
  return { buffer };
}

function parseDistinguishedName(text) {
  const fields = {};
  String(text || '').split('\n').forEach((line) => {
    const index = line.indexOf('=');
    if (index > 0) fields[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  });
  return fields;
}

/** Same derivation as em_backend/utilities/certificateSignature.js so both services agree on a pin. */
function certificateThumbprint(certificate) {
  return String(certificate.fingerprint256 || '').replace(/:/g, '').toLowerCase();
}

function readCertificateIdentity(certificate) {
  const subject = parseDistinguishedName(certificate.subject);
  const issuer = parseDistinguishedName(certificate.issuer);
  const emailMatch = String(certificate.subjectAltName || '').match(/email:([^,]+)/i);
  return {
    subjectCommonName: subject.CN || '',
    subjectOrganization: subject.O || '',
    subjectEmail: (emailMatch ? emailMatch[1] : subject.emailAddress || '').trim().toLowerCase(),
    issuerCommonName: issuer.CN || '',
    serialNumber: String(certificate.serialNumber || '').replace(/^0+/, ''),
    validFrom: certificate.validFromDate || (certificate.validFrom ? new Date(certificate.validFrom) : null),
    validTo: certificate.validToDate || (certificate.validTo ? new Date(certificate.validTo) : null),
    thumbprint: certificateThumbprint(certificate),
    spkiSha256: crypto.createHash('sha256').update(certificate.publicKey.export({ type: 'spki', format: 'der' })).digest('hex'),
  };
}

/** Rejects certificates that are the wrong kind of certificate, regardless of who issued them. */
function checkCertificateShape(certificate) {
  const now = new Date();
  const identity = readCertificateIdentity(certificate);
  if (identity.validTo && identity.validTo < now) return 'The certificate has expired';
  if (identity.validFrom && identity.validFrom > now) return 'The certificate is not valid yet';
  if (certificate.ca === true) return 'A certificate authority certificate cannot be used to sign';

  const publicKey = certificate.publicKey;
  if (publicKey.asymmetricKeyType !== 'rsa') return 'Only RSA certificates are accepted';
  if (((publicKey.asymmetricKeyDetails || {}).modulusLength || 0) < MIN_RSA_MODULUS_BITS) return 'The certificate key is too weak';

  // Node reports extended key usage here; a server or code-signing cert is not a person's signing cert
  const usages = Array.isArray(certificate.keyUsage) ? certificate.keyUsage : [];
  const has = (list) => usages.some((usage) => list.includes(usage));
  if (usages.length > 0 && (has(EKU_SERVER_AUTH) || has(EKU_CODE_SIGNING)) && !has(EKU_PERSON_SIGNING)) {
    return 'This certificate was issued for a server or for software, not for a person';
  }
  return null;
}

/** True when the account name and the certificate name are the same person's name in any order. */
function namesMatch(typedName, certificateName) {
  const clean = (value) => normalizeValue(value).toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  const a = clean(typedName);
  const b = clean(certificateName);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.split(' ').sort().join(' ') === b.split(' ').sort().join(' ');
}

/**
 * Proof of possession at enrolment: the browser signed {purpose, userId, email, signedAt} with the
 * private key of the certificate it is enrolling. Returns the verified identity or an error.
 */
function verifyEnrolment({ userId, email, signedAt, certificateBase64, signatureBase64 }) {
  const signature = decodeBase64(signatureBase64, MAX_SIGNATURE_BYTES, 'Signature');
  if (signature.error) return { ok: false, error: signature.error };
  const der = decodeBase64(certificateBase64, MAX_CERTIFICATE_BYTES, 'Certificate');
  if (der.error) return { ok: false, error: der.error };

  let certificate;
  try {
    certificate = new crypto.X509Certificate(der.buffer);
  } catch {
    return { ok: false, error: 'The certificate could not be read' };
  }

  const shapeError = checkCertificateShape(certificate);
  if (shapeError) return { ok: false, error: shapeError };

  const signedAtDate = new Date(signedAt);
  if (Number.isNaN(signedAtDate.getTime())) return { ok: false, error: 'The signing time is missing or invalid' };
  if (Math.abs(Date.now() - signedAtDate.getTime()) > MAX_CLOCK_SKEW_MS) return { ok: false, error: 'The enrolment signature is too old, please try again' };

  const payload = buildEnrolmentPayload({ purpose: ENROLMENT_PURPOSE, userId, email, signedAt });
  let valid = false;
  try {
    valid = crypto.verify(SIGNATURE_ALGORITHM, Buffer.from(payload, 'utf8'), certificate.publicKey, signature.buffer);
  } catch {
    return { ok: false, error: 'The signature could not be checked' };
  }
  if (!valid) return { ok: false, error: 'The signature does not match this certificate' };

  return { ok: true, identity: readCertificateIdentity(certificate), certificateDer: der.buffer.toString('base64') };
}

module.exports = { verifyEnrolment, checkCertificateShape, readCertificateIdentity, certificateThumbprint, namesMatch, decodeBase64 };
