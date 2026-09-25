import forge from 'node-forge';

// node-forge is used ONLY to open the PKCS#12 container and export the key.
// The signature itself is produced by WebCrypto, so forge is never in the crypto path.

const APPEARANCE_WIDTH = 560;
const APPEARANCE_HEIGHT = 170;
const INK_PANEL_WIDTH = 236;

// forge speaks binary strings; the browser APIs want bytes
function binaryStringToBytes(binary) {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return window.btoa(binary);
}

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

function findLeafCertificate(p12, privateKey) {
  const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const entries = bags[forge.pki.oids.certBag] || [];
  if (entries.length === 0) return null;
  // The container can hold the whole chain, so pick the cert whose key matches
  const matching = entries.find(
    (entry) => entry.cert && entry.cert.publicKey && entry.cert.publicKey.n && entry.cert.publicKey.n.equals(privateKey.n),
  );
  return (matching || entries[0]).cert;
}

function extractPrivateKey(p12) {
  const shrouded = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const shroudedBag = (shrouded[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0];
  if (shroudedBag && shroudedBag.key) return shroudedBag.key;
  const plain = p12.getBags({ bagType: forge.pki.oids.keyBag });
  const plainBag = (plain[forge.pki.oids.keyBag] || [])[0];
  return plainBag && plainBag.key ? plainBag.key : null;
}

/**
 * Opens a .p12 / .pfx with the holder's password and returns the key and certificate details.
 * Everything happens in this browser; the container and the password are never sent anywhere.
 */
export async function openCertificate(file, password) {
  const buffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);

  let p12;
  try {
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(binary));
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
  } catch (error) {
    // forge reports a bad password and a corrupt container through the same failure
    const message = String((error && error.message) || '');
    if (/mac could not be verified|invalid password|Invalid password/i.test(message)) {
      throw new Error('Wrong password for this certificate file.');
    }
    throw new Error('This file could not be opened as a digital certificate.');
  }

  const privateKey = extractPrivateKey(p12);
  if (!privateKey) throw new Error('No private key was found in this certificate file.');
  if (!privateKey.n) throw new Error('Only RSA certificates are supported for signing.');

  const certificate = findLeafCertificate(p12, privateKey);
  if (!certificate) throw new Error('No certificate was found in this file.');

  const now = new Date();
  if (certificate.validity.notAfter < now) throw new Error('This certificate has expired.');
  if (certificate.validity.notBefore > now) throw new Error('This certificate is not valid yet.');

  const pkcs8 = forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(privateKey));
  const certificateDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes();

  return {
    pkcs8Bytes: binaryStringToBytes(forge.asn1.toDer(pkcs8).getBytes()),
    certificateBase64: bytesToBase64(binaryStringToBytes(certificateDer)),
    subjectCommonName: readField('CN', certificate.subject),
    subjectOrganization: readField('O', certificate.subject),
    subjectEmail: readCertificateEmail(certificate),
    issuerCommonName: readField('CN', certificate.issuer),
    serialNumber: String(certificate.serialNumber || '').replace(/^0+/, ''),
    validFrom: certificate.validity.notBefore.toISOString(),
    validTo: certificate.validity.notAfter.toISOString(),
  };
}

/** Signs the canonical bytes with WebCrypto and returns a base64 RSA signature. */
export async function signCanonicalBytes(pkcs8Bytes, payloadBytes) {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error('Signing needs a secure connection. Open this page over HTTPS.');
  }
  const key = await window.crypto.subtle.importKey(
    'pkcs8',
    pkcs8Bytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await window.crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, payloadBytes);
  return bytesToBase64(new Uint8Array(signature));
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('handwriting_image_failed'));
    image.src = source;
  });
}

// Fits the drawn ink inside the panel without stretching it
function drawInk(context, image, panelWidth) {
  const padding = 14;
  const maxWidth = panelWidth - padding * 2;
  const maxHeight = APPEARANCE_HEIGHT - padding * 2;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  context.drawImage(image, padding + (maxWidth - width) / 2, padding + (maxHeight - height) / 2, width, height);
}

/**
 * Draws the visible signature block that gets stored and shown on the attendance sheet.
 * With handwriting it mirrors a signed PDF: the drawn ink on the left, the certificate
 * details on the right. A certificate holds no handwriting, so the ink is supplied here.
 */
export async function renderAppearanceImage({ signerName, issuerName, serialNumber, signedAt, handwritingDataUrl }) {
  const ratio = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.width = APPEARANCE_WIDTH * ratio;
  canvas.height = APPEARANCE_HEIGHT * ratio;
  const context = canvas.getContext('2d');
  context.scale(ratio, ratio);

  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, APPEARANCE_WIDTH, APPEARANCE_HEIGHT);
  context.strokeStyle = '#056DAA';
  context.lineWidth = 1.5;
  context.strokeRect(1, 1, APPEARANCE_WIDTH - 2, APPEARANCE_HEIGHT - 2);

  let textLeft = 18;
  if (handwritingDataUrl) {
    try {
      drawInk(context, await loadImage(handwritingDataUrl), INK_PANEL_WIDTH);
      context.strokeStyle = '#D6E4EE';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(INK_PANEL_WIDTH, 14);
      context.lineTo(INK_PANEL_WIDTH, APPEARANCE_HEIGHT - 14);
      context.stroke();
      textLeft = INK_PANEL_WIDTH + 18;
    } catch {
      // The handwriting is decoration, so a failure here must not block signing
      textLeft = 18;
    }
  }

  const textWidth = APPEARANCE_WIDTH - textLeft - 16;
  context.fillStyle = '#056DAA';
  context.font = 'bold 11px Montserrat, sans-serif';
  context.fillText('DIGITALLY SIGNED', textLeft, 34);

  context.fillStyle = '#1F2937';
  context.font = 'bold 15px Montserrat, sans-serif';
  let name = signerName || 'Unknown signer';
  while (context.measureText(name).width > textWidth && name.length > 4) {
    name = `${name.slice(0, -2)}…`;
  }
  context.fillText(name, textLeft, 62);

  context.fillStyle = '#4B5563';
  context.font = '11px Montserrat, sans-serif';
  context.fillText(`Issued by: ${issuerName || 'Unknown issuer'}`, textLeft, 88);
  context.fillText(`Serial: ${(serialNumber || 'n/a').slice(0, 24)}`, textLeft, 108);
  context.fillText(`Signed: ${new Date(signedAt).toLocaleString()}`, textLeft, 128);

  return canvas.toDataURL('image/png');
}
