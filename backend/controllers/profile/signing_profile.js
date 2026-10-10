const crypto = require('crypto')
const { StatusCodes } = require('http-status-codes')
const UserSigningProfile = require('../../models/user_signing_profile')
const { openPkcs12, namesMatch } = require('../../utilities/pkcs12')

// A staff member's own signature image, placed on the attendance sheet when they sign event attendance.

const PNG_DATA_URL_PREFIX = 'data:image/png;base64,'
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const MAX_IMAGE_BYTES = 200000
const MAX_PFX_BYTES = 65536
const MAX_PASSWORD_CHARS = 256

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

// Everything about the stored certificate except the container itself
const toCertificateSummary = (certificate) => {
    const pfx = toBuffer(certificate && certificate.pfx)
    if (!pfx || pfx.length === 0) return null
    return {
        file_name: certificate.file_name || '',
        subject_common_name: certificate.subject_common_name || '',
        subject_email: certificate.subject_email || '',
        issuer_common_name: certificate.issuer_common_name || '',
        serial_number: certificate.serial_number || '',
        thumbprint: certificate.thumbprint || '',
        valid_from: certificate.valid_from || null,
        valid_to: certificate.valid_to || null,
        uploaded_at: certificate.uploaded_at || null
    }
}

const decodePfxBase64 = (certificate) => {
    if (typeof certificate !== 'string' || !certificate.trim()) {
        return { error: 'certificate must be the .p12/.pfx file as base64' }
    }
    const base64 = certificate.replace(/^data:[^,]*,/, '').replace(/\s+/g, '')
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
        return { error: 'certificate is not valid base64' }
    }
    const buffer = Buffer.from(base64, 'base64')
    if (buffer.length === 0) return { error: 'certificate file is empty' }
    if (buffer.length > MAX_PFX_BYTES) return { error: `certificate file must be at most ${MAX_PFX_BYTES} bytes` }
    return { buffer }
}

const getSigningProfile = async (req, res) => {
    try {
        const profile = await UserSigningProfile.findOne({ user_id: req.user.id }).lean()
        const signatureImage = profile ? toSignatureDataUrl(profile.signature_image) : null
        const certificate = profile ? toCertificateSummary(profile.signing_certificate) : null
        return res.status(StatusCodes.OK).json({
            status: true,
            data: {
                has_signature_image: !!signatureImage,
                signature_image: signatureImage,
                has_signing_certificate: !!certificate,
                signing_certificate: certificate
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

// The PFX is only kept once it has opened with the password the holder typed; the password is then forgotten
const updateSigningCertificate = async (req, res) => {
    try {
        const { certificate, password, file_name } = req.body || {}
        const decoded = decodePfxBase64(certificate)
        if (decoded.error) {
            return res.status(StatusCodes.BAD_REQUEST).json({ status: false, message: decoded.error })
        }
        if (typeof password !== 'string' || password.length > MAX_PASSWORD_CHARS) {
            return res.status(StatusCodes.BAD_REQUEST).json({ status: false, message: 'password is required' })
        }

        const opened = openPkcs12(decoded.buffer, password)
        if (opened.error) {
            return res.status(StatusCodes.BAD_REQUEST).json({ status: false, message: opened.error })
        }

        // A certificate issued to someone else would be refused at signing time anyway, so refuse it here
        const identity = opened.identity
        if (!namesMatch(req.user.full_name, identity.subjectCommonName)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: `This certificate belongs to ${identity.subjectCommonName || 'someone else'}, not to your account. It was not saved.`
            })
        }

        const now = new Date()
        const safeFileName = String(file_name || '').replace(/[^\w.\- ]/g, '').slice(0, 120)
        await UserSigningProfile.findOneAndUpdate(
            { user_id: req.user.id },
            {
                $set: {
                    signing_certificate: {
                        pfx: decoded.buffer,
                        size: decoded.buffer.length,
                        sha256: crypto.createHash('sha256').update(decoded.buffer).digest('hex'),
                        file_name: safeFileName,
                        subject_common_name: identity.subjectCommonName,
                        subject_email: identity.subjectEmail,
                        issuer_common_name: identity.issuerCommonName,
                        serial_number: identity.serialNumber,
                        thumbprint: identity.thumbprint,
                        valid_from: identity.validFrom,
                        valid_to: identity.validTo,
                        uploaded_at: now
                    },
                    updated_at: now
                }
            },
            { upsert: true, returnDocument: 'after' }
        )
        const profile = await UserSigningProfile.findOne({ user_id: req.user.id }).lean()
        return res.status(StatusCodes.OK).json({
            status: true,
            message: 'Digital certificate verified and saved',
            data: {
                has_signing_certificate: true,
                signing_certificate: toCertificateSummary(profile && profile.signing_certificate)
            }
        })
    } catch (error) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message })
    }
}

// The stored container, for the owner only; it still needs the holder's password to open, so signing happens in their browser
const getSigningCertificateFile = async (req, res) => {
    try {
        const profile = await UserSigningProfile.findOne({ user_id: req.user.id }).lean()
        const pfx = toBuffer(profile && profile.signing_certificate && profile.signing_certificate.pfx)
        if (!pfx || pfx.length === 0) {
            return res.status(StatusCodes.NOT_FOUND).json({ status: false, message: 'No digital certificate is saved on your profile' })
        }
        return res.status(StatusCodes.OK).json({
            status: true,
            data: {
                pfx: pfx.toString('base64'),
                file_name: profile.signing_certificate.file_name || 'certificate.p12',
                signing_certificate: toCertificateSummary(profile.signing_certificate)
            }
        })
    } catch (error) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message })
    }
}

const removeSigningCertificate = async (req, res) => {
    try {
        await UserSigningProfile.updateOne(
            { user_id: req.user.id },
            { $unset: { signing_certificate: '' }, $set: { updated_at: new Date() } }
        )
        return res.status(StatusCodes.OK).json({ status: true, message: 'Digital certificate removed' })
    } catch (error) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message })
    }
}

module.exports = {
    getSigningProfile,
    updateSignatureImage,
    removeSignatureImage,
    updateSigningCertificate,
    getSigningCertificateFile,
    removeSigningCertificate
}
