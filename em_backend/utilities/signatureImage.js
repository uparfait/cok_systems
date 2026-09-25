// A Buffer field read through .lean() comes back as a BSON Binary, not a Buffer,
// and its .length is a function - so Buffer.from(value) silently yields zero bytes.
function toBuffer(value) {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  if (Buffer.isBuffer(value.buffer)) return Buffer.from(value.buffer);
  if (typeof value.value === 'function') return Buffer.from(value.value(true));
  if (Array.isArray(value.data)) return Buffer.from(value.data);
  if (value instanceof Uint8Array) return Buffer.from(value);
  return null;
}

/** The drawn signature if there is one, otherwise the stored certificate appearance blob. */
function toSignatureDataUrl(attendance) {
  if (!attendance) return '';
  if (attendance.attendeeSignature) return attendance.attendeeSignature;
  const buffer = toBuffer(attendance.signatureImage);
  if (!buffer || buffer.length === 0) return '';
  return `data:${attendance.signatureImageType || 'image/png'};base64,${buffer.toString('base64')}`;
}

module.exports = { toBuffer, toSignatureDataUrl };
