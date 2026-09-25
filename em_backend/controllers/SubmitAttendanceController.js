const Attendance = require('../models/Attendance');
const LiveEvent = require('../models/LiveEvent');
const config = require('../configurations/config');
const { verifyAttendanceSignature, namesMatch } = require('../utilities/certificateSignature');

const MAX_APPEARANCE_IMAGE_BYTES = 400000;

// Turns the browser's "data:image/png;base64,..." appearance into the stored blob
function decodeAppearanceImage(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) {
    return { error: 'The signature image must be a PNG data URL' };
  }
  const buffer = Buffer.from(dataUrl.split(',')[1] || '', 'base64');
  if (buffer.length === 0) return { error: 'The signature image is empty' };
  if (buffer.length > MAX_APPEARANCE_IMAGE_BYTES) return { error: 'The signature image is too large' };
  return { buffer };
}

class SubmitAttendanceController {
  static async handle(req, res) {
    try {
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
      } = req.body;

      const isCertificateSigned = signatureMethod === 'digital-certificate';

      if (!attendeeFullName || !attendeePhoneNumber || !attendeeInstitution || !attendeePosition || !eventSpecialId) {
        return res.status(400).json({
          success: false,
          message: 'Full name, phone number, institution, position, and event ID are required'
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

      if (attendeeSignature) {
        if (typeof attendeeSignature !== 'string' || !attendeeSignature.startsWith('data:image/png;base64,')) {
          return res.status(400).json({
            success: false,
            message: 'Signature must be a PNG image data URL'
          });
        }
        if (attendeeSignature.length > 200000) {
          return res.status(400).json({
            success: false,
            message: 'Signature image is too large'
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

      // Prevent duplicate attendance by phone number
      const existingAttendance = await Attendance.findOne({
        eventSpecialId,
        attendeePhoneNumber: attendeePhoneNumber.trim()
      });

      if (existingAttendance) {
        return res.status(409).json({
          success: false,
          message: 'Attendance for this phone number has already been recorded for this event'
        });
      }

      // Prevent duplicate attendance by email
      if (attendeeEmail) {
        const existingEmailAttendance = await Attendance.findOne({
          eventSpecialId,
          attendeeEmail: attendeeEmail.toLowerCase().trim()
        });

        if (existingEmailAttendance) {
          return res.status(409).json({
            success: false,
            message: 'Attendance for this email has already been recorded for this event'
          });
        }
      }

      const hasDigitalCertificate = req.file
        ? `${config.api.basePath}/uploads/${req.file.filename}`
        : undefined;

      // These are the exact values that were signed and that get stored
      const signedFields = {
        eventSpecialId,
        attendeeFullName: attendeeFullName.trim(),
        attendeeEmail: attendeeEmail ? attendeeEmail.toLowerCase().trim() : '',
        attendeePhoneNumber: attendeePhoneNumber.trim(),
        attendeeInstitution: attendeeInstitution.trim(),
        attendeePosition: attendeePosition.trim(),
        attendeeDepartment: String(attendeeDepartment || '').trim(),
        signedAt: certificateSignature ? certificateSignature.signedAt : undefined,
      };

      let certificateRecord;
      let appearanceBlob;

      if (isCertificateSigned) {
        if (!certificateSignature || typeof certificateSignature !== 'object') {
          return res.status(400).json({
            success: false,
            message: 'Certificate signature details are required'
          });
        }

        const appearance = decodeAppearanceImage(certificateSignature.appearanceImage);
        if (appearance.error) {
          return res.status(400).json({ success: false, message: appearance.error });
        }
        appearanceBlob = appearance.buffer;

        const verification = verifyAttendanceSignature({
          fields: signedFields,
          signatureBase64: certificateSignature.signatureValue,
          certificateBase64: certificateSignature.certificate,
          trustedIssuerCommonName: config.signing.trustedIssuerCommonName,
        });

        if (!verification.valid) {
          return res.status(422).json({ success: false, message: verification.error });
        }

        // This is what stops one person signing in another person's name
        const nameMatched = namesMatch(signedFields.attendeeFullName, verification.identity.subjectCommonName);
        if (config.signing.requireNameMatch && !nameMatched) {
          return res.status(422).json({
            success: false,
            message: `This certificate belongs to ${verification.identity.subjectCommonName}. Enter that name to sign with it.`
          });
        }

        certificateRecord = {
          signatureValue: certificateSignature.signatureValue,
          certificate: certificateSignature.certificate,
          signedPayload: Buffer.from(verification.canonicalPayload, 'utf8'),
          subjectCommonName: verification.identity.subjectCommonName,
          subjectOrganization: verification.identity.subjectOrganization,
          subjectEmail: verification.identity.subjectEmail,
          issuerCommonName: verification.identity.issuerCommonName,
          serialNumber: verification.identity.serialNumber,
          thumbprint: verification.identity.thumbprint,
          validFrom: verification.identity.validFrom,
          validTo: verification.identity.validTo,
          signedAt: new Date(signedFields.signedAt),
          verifiedAt: verification.verifiedAt,
          chainVerified: verification.chainVerified,
          nameMatchedTypedName: nameMatched,
        };
      }

      const attendance = new Attendance({
        attendeeFullName: attendeeFullName.trim(),
        attendeeEmail: attendeeEmail ? attendeeEmail.toLowerCase().trim() : undefined,
        attendeePhoneNumber: attendeePhoneNumber.trim(),
        attendeeInstitution: attendeeInstitution.trim(),
        attendeeDepartment: String(attendeeDepartment || '').trim(),
        attendeePosition: attendeePosition.trim(),
        eventSpecialId,
        eventName: eventName || undefined,
        eventRoom: eventRoom || undefined,
        roomLocation: roomLocation || undefined,
        attendeeSignature: attendeeSignature || undefined,
        digitalCertificate: hasDigitalCertificate,
        signatureMethod: signatureMethod || undefined,
        signatureImage: appearanceBlob,
        signatureImageType: appearanceBlob ? 'image/png' : undefined,
        certificateSignature: certificateRecord,
        attendanceTime: new Date(),
      });

      await attendance.save();

      return res.status(201).json({
        success: true,
        message: 'Attendance recorded successfully',
        data: {
          attendeeFullName: attendance.attendeeFullName,
          attendeeEmail: attendance.attendeeEmail,
          attendanceTime: attendance.attendanceTime,
          signatureMethod: attendance.signatureMethod,
          hasSignature: !!attendance.attendeeSignature || !!attendance.signatureImage,
          hasDigitalCertificate: !!attendance.digitalCertificate,
          signedBy: certificateRecord ? certificateRecord.subjectCommonName : undefined,
          certificateIssuer: certificateRecord ? certificateRecord.issuerCommonName : undefined,
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
