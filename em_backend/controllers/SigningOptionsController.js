const { findSystemUserByContact, findSigningProfile } = require('../utilities/cokUsers');
const { namesMatch } = require('../utilities/certificateSignature');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Tells the attendance form whether the typed email belongs to an account with a saved signature, and whether the typed
// name matches the certificate saved on that account; booleans only, never names
class SigningOptionsController {
  static async handle(req, res) {
    try {
      const email = String((req.body && req.body.email) || '').trim().toLowerCase();
      const fullName = String((req.body && req.body.fullName) || '').trim();
      if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ success: false, message: 'A valid email is required' });
      }

      const matched = await findSystemUserByContact({ email });
      const profile = matched ? await findSigningProfile(matched.user._id) : null;

      // A saved certificate is offered only when the person typing is the person named on it
      const certificate = profile?.signing_certificate;
      const hasSigningCertificate = !!certificate?.pfx && !!fullName && namesMatch(fullName, certificate.subject_common_name);

      return res.status(200).json({
        success: true,
        data: {
          isSystemUser: !!matched,
          hasSignatureImage: !!profile?.signature_image?.data,
          hasSigningCertificate,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error checking signing options',
        error: error.message,
      });
    }
  }
}

module.exports = SigningOptionsController;
