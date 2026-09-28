const crypto = require('crypto')
const { StatusCodes } = require('http-status-codes')
const UserSigningProfile = require('../../models/user_signing_profile')

// A staff member's own signature image, placed on the attendance sheet when they sign event attendance.

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

const getSigningProfile = async (req, res) => {
    try {
        const profile = await UserSigningProfile.findOne({ user_id: req.user.id }).lean()
        const signatureImage = profile ? toSignatureDataUrl(profile.signature_image) : null
        return res.status(StatusCodes.OK).json({
            status: true,
            data: {
                has_signature_image: !!signatureImage,
                signature_image: signatureImage
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

module.exports = {
    getSigningProfile,
    updateSignatureImage,
    removeSignatureImage
}
