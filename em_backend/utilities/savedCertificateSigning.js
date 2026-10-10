const crypto = require('crypto');
const forge = require('node-forge');

// Opens the .p12/.pfx a staff member saved on their profile with the password they type at signing time,
// then signs the canonical attendance bytes here so the container never has to leave the server.
// node-forge only unpacks the PKCS#12; the signature itself comes from Node's crypto.

const SIGNATURE_ALGORITHM = 'RSA-SHA256';
const MIN_RSA_MODULUS_BITS = 2048;

function readField(name, entity) {
  const field = entity.getField(name);
  return field && field.value ? String(field.value).trim() : '';
}

// Prefer the rfc822Name SAN over the deprecated emailAddress RDN
function readCertificateEmail(certificate) {
  const san = certificate.getExtension('subjectAltName');
  if (san && Array.isArray(san.altNames)) {
    const entry = san.altNames.find((alt) => alt.type === 1 && alt.value);
    if (entry) return String(entry.value).trim();
  }
  return readField('E', certificate.subject);
}

function extractPrivateKey(p12) {
  const shrouded = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const shroudedBag = (shrouded[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0];
  if (shroudedBag && shroudedBag.key) return shroudedBag.key;
  const plain = p12.getBags({ bagType: forge.pki.oids.keyBag });
  const plainBag = (plain[forge.pki.oids.keyBag] || [])[0];
  return plainBag && plainBag.key ? plainBag.key : null;
}

// The container may hold the whole chain, so pick the certificate whose key matches
function findLeafCertificate(p12, privateKey) {
  const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const entries = bags[forge.pki.oids.certBag] || [];
  if (entries.length === 0) return null;
  const matching = entries.find(
    (entry) => entry.cert && entry.cert.publicKey && entry.cert.publicKey.n && entry.cert.publicKey.n.equals(privateKey.n),
  );
  return (matching || entries[0]).cert;
}

function parseWithPassword(asn1, password) {
  try {
    return { p12: forge.pkcs12.pkcs12FromAsn1(asn1, password) };
  } catch (error) {
    const message = String((error && error.message) || '');
    if (/mac could not be verified|invalid password|Unable to decrypt|Cannot read encrypted/i.test(message)) {
      return { error: 'Wrong certificate password.', wrongPassword: true };
    }
    return { error: 'Your saved certificate could not be opened.' };
  }
}

/**
 * Returns { privateKeyPem, certificateBase64, identity } when the PFX opens with the password,
 * otherwise { error, wrongPassword? } with a message safe to send back.
 */
function openSavedCertificate(pfxBuffer, password) {
  let asn1;
  try {
    asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfxBuffer.toString('binary')));
  } catch {
    return { error: 'Your saved certificate could not be opened.' };
  }

  // Some exporters write an empty password as null rather than ''
  let opened = parseWithPassword(asn1, password);
  if (opened.error && !password) opened = parseWithPassword(asn1, null);
  if (opened.error) return opened;

  const privateKey = extractPrivateKey(opened.p12);
  if (!privateKey || !privateKey.n) return { error: 'Your saved certificate holds no usable RSA key.' };
  if (privateKey.n.bitLength() < MIN_RSA_MODULUS_BITS) return { error: 'Your saved certificate key is too weak.' };

  const certificate = findLeafCertificate(opened.p12, privateKey);
  if (!certificate) return { error: 'Your saved certificate file holds no certificate.' };

  const now = new Date();
  if (certificate.validity.notAfter < now) return { error: 'Your saved certificate has expired. Upload a new one on your profile.' };
  if (certificate.validity.notBefore > now) return { error: 'Your saved certificate is not valid yet.' };

  const certificateDer = Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes(), 'binary');

  return {
    privateKeyPem: forge.pki.privateKeyToPem(privateKey),
    certificateBase64: certificateDer.toString('base64'),
    identity: {
      subjectCommonName: readField('CN', certificate.subject),
      subjectEmail: readCertificateEmail(certificate),
      issuerCommonName: readField('CN', certificate.issuer),
      serialNumber: String(certificate.serialNumber || '').replace(/^0+/, ''),
    },
  };
}

/** Base64 RSA-SHA256 signature over the canonical payload, the same bytes the browser would sign. */
function signCanonicalPayload(privateKeyPem, canonicalPayload) {
  return crypto.sign(SIGNATURE_ALGORITHM, Buffer.from(canonicalPayload, 'utf8'), privateKeyPem).toString('base64');
}

module.exports = { openSavedCertificate, signCanonicalPayload };
