const { authenticateBearer } = require('../middlewares/authenticate');
const { findSystemUserById, findSigningProfile } = require('../utilities/cokUsers');

// Tells the signed-in attendee what the attendance form can prefill and which signing assets the profile holds
class AttendanceMeController {
  static async handle(req, res) {
    try {
      const auth = await authenticateBearer(req.headers.authorization);
      if (!auth.ok) return res.status(auth.status).json(auth.body);

      // The bearer carries no telephone, so the account is read once more for it
      const user = (await findSystemUserById(auth.user.user_id)) || { full_name: auth.user.full_name, email: auth.user.email, telephone: '' };
      const profile = await findSigningProfile(auth.user.user_id);
      // Only a summary; the stored .p12 itself is served by the main backend to its owner
      const certificate = profile?.signing_certificate;
      const hasSigningCertificate = !!certificate?.pfx;

      return res.status(200).json({
        success: true,
        data: {
          fullName: user.full_name || '',
          email: user.email || '',
          telephone: user.telephone || '',
          hasSignatureImage: !!profile?.signature_image?.data,
          hasSigningCertificate,
          signingCertificate: hasSigningCertificate
            ? {
              subjectCommonName: certificate.subject_common_name || '',
              issuerCommonName: certificate.issuer_common_name || '',
              validTo: certificate.valid_to || null,
              fileName: certificate.file_name || '',
            }
            : null,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error loading your signing details',
        error: error.message,
      });
    }
  }
}

module.exports = AttendanceMeController;
