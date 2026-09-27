const Attendance = require('../models/Attendance');
const LiveEvent = require('../models/LiveEvent');
const config = require('../configurations/config');
const { verifyAttendanceSignature, namesMatch } = require('../utilities/certificateSignature');
const { findSystemUserByContact, findSigningProfile } = require('../utilities/cokUsers');
const { canonicalPhone } = require('../utilities/phone');
const { toBuffer } = require('../utilities/signatureImage');

const MAX_APPEARANCE_IMAGE_BYTES = 400000;
const MAX_DRAWN_SIGNATURE_CHARS = 200000;
const PNG_DATA_URL_PREFIX = 'data:image/png;base64,';

const REQUIRED_TEXT_FIELDS = ['attendeeFullName', 'attendeePhoneNumber', 'attendeeInstitution', 'attendeePosition', 'eventSpecialId'];
const OPTIONAL_TEXT_FIELDS = ['attendeeEmail', 'attendeeDepartment', 'eventName', 'eventRoom', 'roomLocation'];

const DUPLICATE_MESSAGE = 'You have already signed attendance for this event';

// Anything that is not a string would make .trim() throw and leak the error as a 500
function findNonStringField(body) {
  return [...REQUIRED_TEXT_FIELDS, ...OPTIONAL_TEXT_FIELDS].find(
    (name) => body[name] !== undefined && body[name] !== null && typeof body[name] !== 'string',
  );
}

function isPngDataUrl(value) {
  return typeof value === 'string' && value.startsWith(PNG_DATA_URL_PREFIX) && value.length > PNG_DATA_URL_PREFIX.length;
}

// Turns the browser's "data:image/png;base64,..." appearance into the stored blob
function decodeAppearanceImage(dataUrl) {
  if (!isPngDataUrl(dataUrl)) {
    return { error: 'The signature image must be a PNG data URL' };
  }
  const buffer = Buffer.from(dataUrl.split(',')[1] || '', 'base64');
  if (buffer.length === 0) return { error: 'The signature image is empty' };
  if (buffer.length > MAX_APPEARANCE_IMAGE_BYTES) return { error: 'The signature image is too large' };
  return { buffer };
}

function staffRefusal(res, status, code, message) {
  return res.status(status).json({ success: false, code, message });
}

class SubmitAttendanceController {
  static async handle(req, res) {
    try {
      const body = req.body || {};

      const nonStringField = findNonStringField(body);
      if (nonStringField) {
        return res.status(400).json({
          success: false,
          message: `${nonStringField} must be text`
        });
      }

      const {
        attendeeFullName,
        attendeeEmail,
        attendeePhoneNumber,
        attendeeInstitution,
        attendeeDepartment,
        attendeePosition,
        eventSpecialId,
        attendeeSignature,
        signatureMethod,
        certificateSignature,
        eventName,
        eventRoom,
        roomLocation,
      } = body;

      if (REQUIRED_TEXT_FIELDS.some((name) => !String(body[name] || '').trim())) {
        return res.status(400).json({
          success: false,
          message: 'Full name, phone number, institution, position, and event ID are required'
        });
      }

      // Exactly one signature: a drawn PNG, or a certificate signature object; the legacy 'certificate' value is refused
      const isDrawn = signatureMethod === 'draw' && isPngDataUrl(attendeeSignature);
      const isCertificateSigned = signatureMethod === 'digital-certificate'
        && !!certificateSignature && typeof certificateSignature === 'object' && !Array.isArray(certificateSignature);
      if (!isDrawn && !isCertificateSigned) {
        return res.status(400).json({
          success: false,
          message: 'A signature is required'
        });
      }

      if (isDrawn && attendeeSignature.length > MAX_DRAWN_SIGNATURE_CHARS) {
        return res.status(400).json({
          success: false,
          message: 'Signature image is too large'
        });
      }

      if (attendeeEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(attendeeEmail)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid email format'
          });
        }
      }

      const liveEvent = await LiveEvent.findOne({ eventSpecialId });
      if (!liveEvent) {
        return res.status(404).json({
          success: false,
          message: 'Event not found or no longer active'
        });
      }

      if (String(liveEvent.eventType || '').toLowerCase() === 'internal' && !attendeeEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email is required for internal meetings'
        });
      }

      // These are the exact values that were signed and that get stored
      const signedFields = {
        eventSpecialId,
        attendeeFullName: attendeeFullName.trim(),
        attendeeEmail: attendeeEmail ? attendeeEmail.toLowerCase().trim() : '',
        attendeePhoneNumber: attendeePhoneNumber.trim(),
        attendeeInstitution: attendeeInstitution.trim(),
        attendeePosition: attendeePosition.trim(),
        attendeeDepartment: String(attendeeDepartment || '').trim(),
        signedAt: isCertificateSigned ? certificateSignature.signedAt : undefined,
      };

      // Prevent duplicate attendance by phone number; older rows only carry the typed spelling
      const attendeePhoneNormalized = canonicalPhone(attendeePhoneNumber);
      const existingAttendance = await Attendance.findOne({
        eventSpecialId,
        $or: [
          ...(attendeePhoneNormalized ? [{ attendeePhoneNormalized }] : []),
          { attendeePhoneNumber: signedFields.attendeePhoneNumber },
        ],
      });

      if (existingAttendance) {
        return res.status(409).json({
          success: false,
          message: 'Attendance for this phone number has already been recorded for this event'
        });
      }

      // Prevent duplicate attendance by email
      if (signedFields.attendeeEmail) {
        const existingEmailAttendance = await Attendance.findOne({
          eventSpecialId,
          attendeeEmail: signedFields.attendeeEmail
        });

        if (existingEmailAttendance) {
          return res.status(409).json({
            success: false,
            message: 'Attendance for this email has already been recorded for this event'
          });
        }
      }

      // Staff detection: the bearer wins, else an active account holding this email or phone; never by name
      let matched = null;
      if (req.user) {
        const accountEmail = String(req.user.email || '').toLowerCase();
        if (!signedFields.attendeeEmail || signedFields.attendeeEmail !== accountEmail) {
          return staffRefusal(res, 409, 'STAFF_ACCOUNT_MISMATCH', 'The signed-in account does not match the details entered.');
        }
        matched = {
          user: { _id: req.user.user_id, full_name: req.user.full_name, email: req.user.email },
          matchedBy: 'bearer',
        };
      } else {
        matched = await findSystemUserByContact({ email: signedFields.attendeeEmail, phone: attendeePhoneNumber });
      }

      if (matched) {
        const existingAccountAttendance = await Attendance.findOne({ eventSpecialId, 'systemUser.userId': matched.user._id });
        if (existingAccountAttendance) {
          return res.status(409).json({ success: false, message: DUPLICATE_MESSAGE });
        }
      }

      const staffRules = !!matched && config.signing.requireCertificateForStaff;
      let profile = null;
      let pinnedThumbprint = '';

      if (staffRules) {
        profile = await findSigningProfile(matched.user._id);
        pinnedThumbprint = profile?.signing_certificate?.thumbprint || '';

        if (!isCertificateSigned) {
          // Rollout escape hatch only: unenrolled staff may still draw when the config allows it
          if (!(config.signing.allowDrawForStaffWithoutCertificate && !pinnedThumbprint)) {
            return staffRefusal(res, 403, 'STAFF_CERTIFICATE_REQUIRED', 'This name belongs to a CoK Systems account. Sign with your digital certificate.');
          }
        } else if (!pinnedThumbprint) {
          return staffRefusal(res, 403, 'STAFF_CERTIFICATE_NOT_ENROLLED', 'Your account has no signing certificate yet. Sign in to CoK Systems, open Profile, then Signature, and enrol your certificate.');
        }
      }

      const uploadedCertificateUrl = req.file
        ? `${config.api.basePath}/uploads/${req.file.filename}`
        : undefined;

      let certificateRecord;
      let signatureImage;
      let signatureImageType;
      let signatureSource = 'drawn';

      if (isCertificateSigned) {
        // The browser-rendered appearance is only trusted for the public; staff render from their enrolled image
        let appearanceBlob;
        if (!staffRules) {
          const appearance = decodeAppearanceImage(certificateSignature.appearanceImage);
          if (appearance.error) {
            return res.status(400).json({ success: false, message: appearance.error });
          }
          appearanceBlob = appearance.buffer;
        }

        const verification = verifyAttendanceSignature({
          fields: signedFields,
          signatureBase64: certificateSignature.signatureValue,
          certificateBase64: certificateSignature.certificate,
          trustedIssuerCommonName: config.signing.trustedIssuerCommonName,
        });

        if (!verification.valid) {
          return res.status(422).json({ success: false, message: verification.error });
        }

        const identity = verification.identity;
        const accountEmail = matched ? String(matched.user.email || '').toLowerCase() : '';
        const certificateEmail = String(identity.subjectEmail || '').toLowerCase();

        if (staffRules) {
          // Stored names and emails are never echoed back; the account holder already knows them
          if (identity.thumbprint !== pinnedThumbprint) {
            return staffRefusal(res, 422, 'STAFF_CERTIFICATE_MISMATCH', 'This is not the certificate enrolled on your account.');
          }
          if (!namesMatch(matched.user.full_name, identity.subjectCommonName)) {
            return staffRefusal(res, 422, 'STAFF_CERTIFICATE_MISMATCH', 'The certificate name does not match your account.');
          }
          if (certificateEmail && certificateEmail !== accountEmail) {
            return staffRefusal(res, 422, 'STAFF_CERTIFICATE_MISMATCH', 'The certificate name does not match your account.');
          }
        }

        // This is what stops one person signing in another person's name
        const nameMatched = namesMatch(signedFields.attendeeFullName, identity.subjectCommonName);
        if (config.signing.requireNameMatch && !nameMatched) {
          return res.status(422).json({
            success: false,
            message: `This certificate belongs to ${identity.subjectCommonName}. Enter that name to sign with it.`
          });
        }

        certificateRecord = {
          signatureValue: certificateSignature.signatureValue,
          certificate: certificateSignature.certificate,
          signedPayload: Buffer.from(verification.canonicalPayload, 'utf8'),
          subjectCommonName: identity.subjectCommonName,
          subjectOrganization: identity.subjectOrganization,
          subjectEmail: identity.subjectEmail,
          issuerCommonName: identity.issuerCommonName,
          serialNumber: identity.serialNumber,
          thumbprint: identity.thumbprint,
          validFrom: identity.validFrom,
          validTo: identity.validTo,
          signedAt: new Date(signedFields.signedAt),
          verifiedAt: verification.verifiedAt,
          chainVerified: verification.chainVerified,
          nameMatchedTypedName: nameMatched,
          thumbprintPinned: staffRules,
          nameMatchedAccountName: staffRules,
          emailMatchedAccount: staffRules && !!certificateEmail && certificateEmail === accountEmail,
        };

        if (staffRules) {
          signatureImage = toBuffer(profile.signature_image?.data) || undefined;
          signatureImageType = profile.signature_image?.mime || 'image/png';
          signatureSource = signatureImage ? 'profile-image' : 'none';
        } else {
          signatureImage = appearanceBlob;
          signatureImageType = 'image/png';
          signatureSource = 'client-appearance';
        }
      }

      const systemUser = matched
        ? {
          userId: matched.user._id,
          email: String(matched.user.email || '').toLowerCase(),
          fullName: matched.user.full_name,
          matchedBy: matched.matchedBy,
        }
        : undefined;

      const attendance = new Attendance({
        attendeeFullName: signedFields.attendeeFullName,
        attendeeEmail: signedFields.attendeeEmail || undefined,
        attendeePhoneNumber: signedFields.attendeePhoneNumber,
        attendeePhoneNormalized: attendeePhoneNormalized || undefined,
        attendeeInstitution: signedFields.attendeeInstitution,
        attendeeDepartment: signedFields.attendeeDepartment,
        attendeePosition: signedFields.attendeePosition,
        eventSpecialId,
        eventName: eventName || undefined,
        eventRoom: eventRoom || undefined,
        roomLocation: roomLocation || undefined,
        attendeeSignature: isDrawn ? attendeeSignature : undefined,
        digitalCertificate: uploadedCertificateUrl,
        signatureMethod,
        signatureImage,
        signatureImageType: signatureImage ? signatureImageType : undefined,
        signatureSource,
        systemUser,
        certificateSignature: certificateRecord,
        attendanceTime: new Date(),
      });

      try {
        await attendance.save();
      } catch (error) {
        // The unique (eventSpecialId, systemUser.userId) index caught a race between two submissions
        if (error && error.code === 11000) {
          return res.status(409).json({ success: false, message: DUPLICATE_MESSAGE });
        }
        throw error;
      }

      return res.status(201).json({
        success: true,
        message: 'Attendance recorded successfully',
        data: {
          attendeeFullName: attendance.attendeeFullName,
          attendeeEmail: attendance.attendeeEmail,
          attendanceTime: attendance.attendanceTime,
          signatureMethod: attendance.signatureMethod,
          signatureSource: attendance.signatureSource,
          hasSignature: !!attendance.attendeeSignature || !!attendance.signatureImage,
          hasDigitalCertificate: !!certificateRecord,
          signedBy: certificateRecord ? certificateRecord.subjectCommonName : undefined,
          certificateIssuer: certificateRecord ? certificateRecord.issuerCommonName : undefined,
          systemUser: systemUser ? { matchedBy: systemUser.matchedBy } : undefined,
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error recording attendance',
        error: error.message
      });
    }
  }
}

module.exports = SubmitAttendanceController;
