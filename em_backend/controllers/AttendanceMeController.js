const { authenticateBearer } = require('../middlewares/authenticate');
const { findSystemUserById, findSigningProfile } = require('../utilities/cokUsers');

// Tells the signed-in attendee what the attendance form can prefill and whether a certificate is pinned
class AttendanceMeController {
  static async handle(req, res) {
    try {
      const auth = await authenticateBearer(req.headers.authorization);
      if (!auth.ok) return res.status(auth.status).json(auth.body);

      // The bearer carries no telephone, so the account is read once more for it
      const user = (await findSystemUserById(auth.user.user_id)) || { full_name: auth.user.full_name, email: auth.user.email, telephone: '' };
      const profile = await findSigningProfile(auth.user.user_id);

      return res.status(200).json({
        success: true,
        data: {
          fullName: user.full_name || '',
          email: user.email || '',
          telephone: user.telephone || '',
          hasSignatureImage: !!profile?.signature_image?.data,
          hasSigningCertificate: !!profile?.signing_certificate?.thumbprint,
          certificateValidTo: profile?.signing_certificate?.valid_to || null,
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
