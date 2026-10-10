const { authenticateBearer } = require('../middlewares/authenticate');
const { findSystemUserByContact, findSigningProfile } = require('../utilities/cokUsers');
const { toBuffer } = require('../utilities/signatureImage');
const { openSavedCertificate, signCanonicalPayload } = require('../utilities/savedCertificateSigning');
const { buildCanonicalPayload } = require('../utilities/canonicalAttendancePayload');
const { namesMatch } = require('../utilities/certificateSignature');

// Signs the attendance fields with the certificate saved on the matching account, unlocked by the password typed on the form.
// The browser then submits the result through the normal digital-certificate path, which re-verifies everything.

const TEXT_FIELDS = ['eventSpecialId', 'attendeeFullName', 'attendeeEmail', 'attendeePhoneNumber', 'attendeeInstitution', 'attendeeDepartment', 'attendeePosition'];
const MAX_PASSWORD_CHARS = 256;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_WINDOW_MS = 15 * 60 * 1000;
const NOT_FOUND_MESSAGE = 'No account with a saved certificate matches the name and email entered.';

// Wrong-password attempts per account, so the saved container cannot be guessed at online
const failedAttempts = new Map();

function attemptsFor(userId) {
  const key = String(userId);
  const entry = failedAttempts.get(key);
  if (!entry || Date.now() - entry.firstAt > LOCK_WINDOW_MS) return { count: 0, firstAt: Date.now() };
  return entry;
}

function recordFailure(userId) {
  const entry = attemptsFor(userId);
  failedAttempts.set(String(userId), { count: entry.count + 1, firstAt: entry.firstAt });
}

function refuse(res, status, code, message) {
  return res.status(status).json({ success: false, code, message });
}

class SignWithSavedCertificateController {
  static async handle(req, res) {
    try {
      const body = req.body || {};

      const nonString = TEXT_FIELDS.find((name) => body[name] !== undefined && body[name] !== null && typeof body[name] !== 'string');
      if (nonString) return refuse(res, 400, 'BAD_FIELD', `${nonString} must be text`);

      const password = body.password;
      if (typeof password !== 'string' || password.length === 0 || password.length > MAX_PASSWORD_CHARS) {
        return refuse(res, 400, 'PASSWORD_REQUIRED', 'Enter the password of your saved certificate.');
      }

      const fields = {
        eventSpecialId: String(body.eventSpecialId || '').trim(),
        attendeeFullName: String(body.attendeeFullName || '').trim(),
        attendeeEmail: String(body.attendeeEmail || '').trim().toLowerCase(),
        attendeePhoneNumber: String(body.attendeePhoneNumber || '').trim(),
        attendeeInstitution: String(body.attendeeInstitution || '').trim(),
        attendeeDepartment: String(body.attendeeDepartment || '').trim(),
        attendeePosition: String(body.attendeePosition || '').trim(),
      };
      if (!fields.eventSpecialId || !fields.attendeeFullName || !fields.attendeeEmail) {
        return refuse(res, 400, 'FIELDS_REQUIRED', 'Full name, email and event ID are required to sign with a saved certificate.');
      }

      // The bearer wins; anyone else is matched only by the email typed, never by name alone
      let matched = null;
      if (req.headers.authorization) {
        const auth = await authenticateBearer(req.headers.authorization);
        if (!auth.ok) return res.status(auth.status).json(auth.body);
        if (String(auth.user.email || '').toLowerCase() !== fields.attendeeEmail) {
          return refuse(res, 409, 'STAFF_ACCOUNT_MISMATCH', 'The signed-in account does not match the details entered.');
        }
        matched = { user: { _id: auth.user.user_id, full_name: auth.user.full_name, email: auth.user.email } };
      } else {
        matched = await findSystemUserByContact({ email: fields.attendeeEmail });
      }
      if (!matched) return refuse(res, 404, 'NO_SAVED_CERTIFICATE', NOT_FOUND_MESSAGE);

      const profile = await findSigningProfile(matched.user._id);
      const pfx = toBuffer(profile?.signing_certificate?.pfx);
      if (!pfx || pfx.length === 0) return refuse(res, 404, 'NO_SAVED_CERTIFICATE', NOT_FOUND_MESSAGE);

      if (attemptsFor(matched.user._id).count >= MAX_FAILED_ATTEMPTS) {
        return refuse(res, 429, 'SAVED_CERTIFICATE_LOCKED', 'Too many wrong passwords. Try again in 15 minutes or sign with the certificate file.');
      }

      const opened = openSavedCertificate(pfx, password);
      if (opened.error) {
        if (opened.wrongPassword) recordFailure(matched.user._id);
        return refuse(res, 422, opened.wrongPassword ? 'SAVED_CERTIFICATE_PASSWORD' : 'SAVED_CERTIFICATE_UNUSABLE', opened.error);
      }
      failedAttempts.delete(String(matched.user._id));

      // The person typing must be the person on the certificate, which is also the account holder
      const identity = opened.identity;
      if (!namesMatch(fields.attendeeFullName, identity.subjectCommonName)) {
        return refuse(res, 422, 'SAVED_CERTIFICATE_NAME_MISMATCH', 'The name entered does not match the name on your saved certificate.');
      }

      // The server picks the signing time, and the browser must submit these exact values with it
      const signedAt = new Date().toISOString();
      const signatureValue = signCanonicalPayload(opened.privateKeyPem, buildCanonicalPayload({ ...fields, signedAt }));

      return res.status(200).json({
        success: true,
        data: {
          signatureValue,
          certificate: opened.certificateBase64,
          signedAt,
          signerName: identity.subjectCommonName,
          issuerName: identity.issuerCommonName,
          serialNumber: identity.serialNumber,
          signedFields: { ...fields, signedAt },
        },
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Error signing with your saved certificate', error: error.message });
    }
  }
}

module.exports = SignWithSavedCertificateController;
