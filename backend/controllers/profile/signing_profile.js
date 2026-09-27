const crypto = require('crypto')
const { StatusCodes } = require('http-status-codes')
const User = require('../../models/user')
const UserSigningProfile = require('../../models/user_signing_profile')
const { verifyEnrolment, namesMatch } = require('../../utilities/signingCertificate')

// A staff member's own signature image and pinned signing certificate, used when they sign event attendance.

const PNG_DATA_URL_PREFIX = 'data:image/png;base64,'
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const MAX_IMAGE_BYTES = 200000

// A Buffer field read through .lean() may come back as a BSON Binary or a serialised { data: [] }
const toBuffer = (value) => {
    if (!value) return null
    if (Buffer.isBuffer(value)) return value
    if (Buffer.isBuffer(value.buffer)) return Buffer.from(value.buffer)
    if (typeof value.value === 'function') return Buffer.from(value.value(true))
    if (Array.isArray(value.data)) return Buffer.from(value.data)
    if (value instanceof Uint8Array) return Buffer.from(value)
    return null
}

const toSignatureDataUrl = (image) => {
    const buffer = toBuffer(image && image.data)
    if (!buffer || buffer.length === 0) return null
    return `data:${(image && image.mime) || 'image/png'};base64,${buffer.toString('base64')}`
}

// Browser-facing view of the pin; certificate_der and spki_sha256 never leave the server
const publicCertificate = (certificate) => {
    if (!certificate || !certificate.thumbprint) return null
    return {
        thumbprint: certificate.thumbprint,
        subject_common_name: certificate.subject_common_name || '',
        subject_email: certificate.subject_email || '',
        issuer_common_name: certificate.issuer_common_name || '',
        serial_number: certificate.serial_number || '',
        valid_from: certificate.valid_from || null,
        valid_to: certificate.valid_to || null,
        enrolled_at: certificate.enrolled_at || null
    }
}

// Only a PNG data URL is accepted; returns the decoded bytes or a message for the 400
const decodePngDataUrl = (image) => {
    if (typeof image !== 'string' || !image.startsWith(PNG_DATA_URL_PREFIX)) {
        return { error: 'image must be a PNG data URL (data:image/png;base64,...)' }
    }
    const base64 = image.slice(PNG_DATA_URL_PREFIX.length).replace(/\s+/g, '')
    if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
        return { error: 'image is not valid base64' }
    }
    const buffer = Buffer.from(base64, 'base64')
    if (buffer.length > MAX_IMAGE_BYTES) {
        return { error: `image must be at most ${MAX_IMAGE_BYTES} bytes` }
    }
    if (buffer.length < PNG_MAGIC.length || !buffer.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
        return { error: 'image is not a PNG file' }
    }
    return { buffer }
}

const isDuplicateKey = (error) => !!(error && (error.code === 11000 || (error.cause && error.cause.code === 11000)))

const getSigningProfile = async (req, res) => {
    try {
        const profile = await UserSigningProfile.findOne({ user_id: req.user.id }).lean()
        const signatureImage = profile ? toSignatureDataUrl(profile.signature_image) : null
        return res.status(StatusCodes.OK).json({
            status: true,
            data: {
                has_signature_image: !!signatureImage,
                signature_image: signatureImage,
                signing_certificate: profile ? publicCertificate(profile.signing_certificate) : null
            }
        })
    } catch (error) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message })
    }
}

const updateSignatureImage = async (req, res) => {
    try {
        const { image } = req.body || {}
        const decoded = decodePngDataUrl(image)
        if (decoded.error) {
            return res.status(StatusCodes.BAD_REQUEST).json({ status: false, message: decoded.error })
        }
        const now = new Date()
        await UserSigningProfile.findOneAndUpdate(
            { user_id: req.user.id },
            {
                $set: {
                    signature_image: {
                        data: decoded.buffer,
                        mime: 'image/png',
                        size: decoded.buffer.length,
                        sha256: crypto.createHash('sha256').update(decoded.buffer).digest('hex'),
                        uploaded_at: now
                    },
                    updated_at: now
                }
            },
            { upsert: true, returnDocument: 'after' }
        )
        return res.status(StatusCodes.OK).json({
            status: true,
            message: 'Signature image saved',
            data: { has_signature_image: true }
        })
    } catch (error) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message })
    }
}

const removeSignatureImage = async (req, res) => {
    try {
        await UserSigningProfile.updateOne(
            { user_id: req.user.id },
            { $unset: { signature_image: '' }, $set: { updated_at: new Date() } }
        )
        return res.status(StatusCodes.OK).json({ status: true, message: 'Signature image removed' })
    } catch (error) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message })
    }
}

const enrolSigningCertificate = async (req, res) => {
    try {
        const { certificate, signatureValue, signedAt } = req.body || {}
        if ([certificate, signatureValue, signedAt].some((value) => typeof value !== 'string' || !value.trim())) {
            return res.status(StatusCodes.BAD_REQUEST).json({ status: false, message: 'certificate, signatureValue and signedAt are required' })
        }
        const user = await User.findById(req.user.id).select('full_name email').lean()
        if (!user) {
            return res.status(StatusCodes.NOT_FOUND).json({ status: false, message: 'User not found' })
        }

        // Everything about the certificate comes from here, never from the request body
        const verified = verifyEnrolment({
            userId: String(req.user.id),
            email: String(req.user.email).toLowerCase(),
            signedAt,
            certificateBase64: certificate,
            signatureBase64: signatureValue
        })
        if (!verified.ok) {
            return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({ status: false, message: verified.error })
        }
        const { identity } = verified
        if (!namesMatch(user.full_name, identity.subjectCommonName)) {
            return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({ status: false, message: 'The certificate name does not match your account name' })
        }
        if (identity.subjectEmail && identity.subjectEmail !== String(user.email || '').toLowerCase()) {
            return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({ status: false, message: 'The certificate email does not match your account email' })
        }

        // Friendly 409 up front; the unique thumbprint index still catches a race in the catch below
        const pinnedElsewhere = await UserSigningProfile.exists({
            'signing_certificate.thumbprint': identity.thumbprint,
            user_id: { $ne: req.user.id }
        })
        if (pinnedElsewhere) {
            return res.status(StatusCodes.CONFLICT).json({ status: false, message: 'This certificate is already enrolled on another account' })
        }

        const now = new Date()
        const profile = await UserSigningProfile.findOneAndUpdate(
            { user_id: req.user.id },
            {
                $set: {
                    signing_certificate: {
                        thumbprint: identity.thumbprint,
                        spki_sha256: identity.spkiSha256,
                        serial_number: identity.serialNumber,
                        subject_common_name: identity.subjectCommonName,
                        subject_email: identity.subjectEmail,
                        issuer_common_name: identity.issuerCommonName,
                        valid_from: identity.validFrom,
                        valid_to: identity.validTo,
                        certificate_der: verified.certificateDer,
                        enrolled_at: now
                    },
                    updated_at: now
                }
            },
            { upsert: true, returnDocument: 'after' }
        ).lean()
        return res.status(StatusCodes.OK).json({
            status: true,
            message: 'Signing certificate enrolled',
            data: { signing_certificate: publicCertificate(profile && profile.signing_certificate) }
        })
    } catch (error) {
        if (isDuplicateKey(error)) {
            return res.status(StatusCodes.CONFLICT).json({ status: false, message: 'This certificate is already enrolled on another account' })
        }
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message })
    }
}

const removeSigningCertificate = async (req, res) => {
    try {
        await UserSigningProfile.updateOne(
            { user_id: req.user.id },
            { $unset: { signing_certificate: '' }, $set: { updated_at: new Date() } }
        )
        return res.status(StatusCodes.OK).json({ status: true, message: 'Signing certificate removed' })
    } catch (error) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message })
    }
}

module.exports = {
    getSigningProfile,
    updateSignatureImage,
    removeSignatureImage,
    enrolSigningCertificate,
    removeSigningCertificate
}
