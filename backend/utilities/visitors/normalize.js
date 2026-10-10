/**
 * Single source of truth for how visitor identity values are cleaned before
 * they are stored or compared. Unique checks only work when every writer
 * normalises the same way, so nothing else should re-implement these rules.
 */

const ID_TYPES = ['National ID', 'Passport', 'Driving Licence'];

const ID_TYPE_ALIASES = {
    'nid': 'National ID',
    'national id': 'National ID',
    'national_id': 'National ID',
    'id': 'National ID',
    'passport': 'Passport',
    'driving licence': 'Driving Licence',
    'driving license': 'Driving Licence',
    'driving permit': 'Driving Licence',
    'driving_licence': 'Driving Licence',
    'driving_license': 'Driving Licence',
};

const GENDERS = ['Male', 'Female'];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trimmed string, or undefined when empty. */
function clean(value) {
    if (value === undefined || value === null) return undefined;
    const text = String(value).trim();
    return text ? text : undefined;
}

function normalizeIdNumber(value) {
    const text = clean(value);
    return text ? text.replace(/\s+/g, '').toUpperCase() : undefined;
}

function normalizeIdType(value) {
    const text = clean(value);
    if (!text) return undefined;
    return ID_TYPE_ALIASES[text.toLowerCase()] || text;
}

/**
 * Rwandan numbers end up in the local 07XXXXXXXX form whatever way they were
 * typed (+250 788..., 250788..., 788..., 0788 ...). Other numbers keep their
 * digits and a leading + when one was given.
 */
function normalizePhone(value) {
    const text = clean(value);
    if (!text) return undefined;
    const hasPlus = text.startsWith('+');
    const digits = text.replace(/\D/g, '');
    if (!digits) return undefined;
    if (/^2507\d{8}$/.test(digits)) return '0' + digits.slice(3);
    if (/^07\d{8}$/.test(digits)) return digits;
    if (!hasPlus && /^7\d{8}$/.test(digits)) return '0' + digits;
    return (hasPlus ? '+' : '') + digits;
}

function normalizeEmail(value) {
    const text = clean(value);
    return text ? text.toLowerCase() : undefined;
}

function normalizeGender(value) {
    const text = clean(value);
    if (!text) return undefined;
    const lower = text.toLowerCase();
    if (lower === 'male' || lower === 'm') return 'Male';
    if (lower === 'female' || lower === 'f') return 'Female';
    return undefined;
}

/** Same rule as the gate has always used: upper case letters and digits only. */
function normalizePlate(value) {
    const text = clean(value);
    return text ? text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';
}

/** Escape user text before it goes into a RegExp. */
function escapeRegex(text) {
    return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Read visitor identity fields from a request body. Accepts the nested
 * identification object and the flat id_type / id_number pair.
 */
function readVisitorInput(source = {}) {
    const src = source || {};
    const ident = src.identification && typeof src.identification === 'object' ? src.identification : {};
    const number = normalizeIdNumber(ident.number || src.id_number);
    return {
        full_name: clean(src.full_name || src.name),
        telephone: normalizePhone(src.telephone || src.phone),
        email: normalizeEmail(src.email),
        // "Not specified" and other values are simply no gender
        gender: normalizeGender(src.gender),
        identification: {
            id_type: number ? (normalizeIdType(ident.id_type || src.id_type) || 'National ID') : undefined,
            number,
        },
    };
}

/**
 * Required, as on the check-in forms: full name and telephone. ID number,
 * email and gender are optional; an email must be valid when given.
 * Returns [{ field, message }].
 */
function validateVisitorInput(input) {
    const errors = [];
    if (!input.full_name) errors.push({ field: 'full_name', message: 'Full name is required' });
    if (!input.telephone) {
        errors.push({ field: 'telephone', message: 'Telephone is required' });
    } else {
        const digits = input.telephone.replace(/\D/g, '');
        if (digits.length < 7 || digits.length > 15) errors.push({ field: 'telephone', message: 'Telephone number is not valid' });
    }
    if (input.email && !EMAIL_PATTERN.test(input.email)) errors.push({ field: 'email', message: 'Email is not valid' });
    return errors;
}

module.exports = {
    ID_TYPES,
    GENDERS,
    clean,
    normalizeIdNumber,
    normalizeIdType,
    normalizePhone,
    normalizeEmail,
    normalizeGender,
    normalizePlate,
    escapeRegex,
    readVisitorInput,
    validateVisitorInput,
};
