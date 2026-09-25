const crypto = require('crypto');
const { buildCanonicalPayload, normalizeValue, SIGNED_FIELD_ORDER } = require('./canonicalAttendancePayload');

// Only the algorithms we accept; never take these from anything the client sent
const SIGNATURE_ALGORITHM = 'RSA-SHA256';
const MIN_RSA_MODULUS_BITS = 2048;
const MAX_SIGNATURE_BYTES = 1024;
const MAX_CERTIFICATE_BYTES = 8192;
const MAX_CLOCK_SKEW_MS = 10 * 60 * 1000; 

function decodeBase64(value, limitBytes, label) {
  if (typeof value !== 'string' || value.length === 0) {
    return { error: `${label} is missing` };
  }
  let buffer;
  try {
    buffer = Buffer.from(value, 'base64');
  } catch {
    return { error: `${label} is not valid base64` };
  }
  if (buffer.length === 0) return { error: `${label} is empty` };
  if (buffer.length > limitBytes) return { error: `${label} is too large` };
  return { buffer };
}

// Reads the signer identity from the DER itself, never from anything the browser claimed
function readCertificateIdentity(certificate) {
  const subject = {};
  String(certificate.subject || '')
    .split('\n')
    .forEach((line) => {
      const index = line.indexOf('=');
      if (index > 0) subject[line.slice(0, index).trim()] = line.slice(index + 1).trim();
    });

  const issuer = {};
  String(certificate.issuer || '')
    .split('\n')
    .forEach((line) => {
      const index = line.indexOf('=');
      if (index > 0) issuer[line.slice(0, index).trim()] = line.slice(index + 1).trim();
    });

  const altNames = String(certificate.subjectAltName || '');
  const emailMatch = altNames.match(/email:([^,]+)/i);

  return {
    subjectCommonName: subject.CN || '',
    subjectOrganization: subject.O || '',
    subjectEmail: (emailMatch ? emailMatch[1] : subject.emailAddress || '').trim(),
    issuerCommonName: issuer.CN || '',
    serialNumber: String(certificate.serialNumber || '').replace(/^0+/, ''),
    validFrom: certificate.validFromDate ? certificate.validFromDate.toISOString() : null,
    validTo: certificate.validToDate ? certificate.validToDate.toISOString() : null,
    thumbprint: certificate.fingerprint256 ? certificate.fingerprint256.replace(/:/g, '').toLowerCase() : '',
  };
}

/**
 * Re-derives the signed bytes from the submitted fields, checks the RSA signature against
 * the certificate's public key, and returns the identity taken from the certificate.
 * Chain-of-trust is NOT checked here: no GovCA root is configured yet, so a self-issued
 * certificate will pass. See trustedIssuerCommonName for the partial check that is applied.
 */
function verifyAttendanceSignature({ fields, signatureBase64, certificateBase64, trustedIssuerCommonName }) {
  const signature = decodeBase64(signatureBase64, MAX_SIGNATURE_BYTES, 'Signature');
  if (signature.error) return { valid: false, error: signature.error };

  const certificateDer = decodeBase64(certificateBase64, MAX_CERTIFICATE_BYTES, 'Certificate');
  if (certificateDer.error) return { valid: false, error: certificateDer.error };

  let certificate;
  try {
    certificate = new crypto.X509Certificate(certificateDer.buffer);
  } catch {
    return { valid: false, error: 'The certificate could not be read' };
  }

  const now = new Date();
  if (certificate.validToDate && certificate.validToDate < now) {
    return { valid: false, error: 'The certificate has expired' };
  }
  if (certificate.validFromDate && certificate.validFromDate > now) {
    return { valid: false, error: 'The certificate is not valid yet' };
  }

  const publicKey = certificate.publicKey;
  const keyDetails = publicKey.asymmetricKeyDetails || {};
  if (publicKey.asymmetricKeyType !== 'rsa') {
    return { valid: false, error: 'Only RSA certificates are accepted' };
  }
  if ((keyDetails.modulusLength || 0) < MIN_RSA_MODULUS_BITS) {
    return { valid: false, error: 'The certificate key is too weak' };
  }

  // The signed timestamp is the client's clock, so only trust it as a freshness bound
  const signedAt = new Date(fields.signedAt);
  if (Number.isNaN(signedAt.getTime())) {
    return { valid: false, error: 'The signing time is missing or invalid' };
  }
  if (Math.abs(now.getTime() - signedAt.getTime()) > MAX_CLOCK_SKEW_MS) {
    return { valid: false, error: 'The signature is too old, please sign again' };
  }

  const canonical = buildCanonicalPayload(fields);
  let signatureIsValid = false;
  try {
    signatureIsValid = crypto.verify(
      SIGNATURE_ALGORITHM,
      Buffer.from(canonical, 'utf8'),
      publicKey,
      signature.buffer,
    );
  } catch {
    return { valid: false, error: 'The signature could not be checked' };
  }
  if (!signatureIsValid) {
    return { valid: false, error: 'The signature does not match the submitted details' };
  }

  const identity = readCertificateIdentity(certificate);

  // Without a pinned root this is the only issuer check available; skipped when unset
  if (trustedIssuerCommonName && identity.issuerCommonName !== trustedIssuerCommonName) {
    return { valid: false, error: 'This certificate was not issued by an accepted authority' };
  }

  return {
    valid: true,
    canonicalPayload: canonical,
    identity,
    chainVerified: false,
    verifiedAt: now,
  };
}

/** True when the name typed on the form matches the name on the certificate. */
function namesMatch(typedName, certificateName) {
  const clean = (value) => normalizeValue(value).toLowerCase().replace(/\s+/g, ' ');
  if (!clean(typedName) || !clean(certificateName)) return false;
  if (clean(typedName) === clean(certificateName)) return true;
  // Accept a reordered name, e.g. "NKURUNZIZA Jean" against "Jean NKURUNZIZA"
  const typedParts = clean(typedName).split(' ').sort().join(' ');
  const certificateParts = clean(certificateName).split(' ').sort().join(' ');
  return typedParts === certificateParts;
}

module.exports = { verifyAttendanceSignature, namesMatch, SIGNED_FIELD_ORDER };
