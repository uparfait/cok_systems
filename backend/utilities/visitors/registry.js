/**
 * Visitor registry: finds people by their unique values and decides whether
 * a submitted form creates a visitor, updates one, or collides with someone
 * else. Rules:
 *  - a value held by ANOTHER visitor is a conflict: "Someone with this
 *    <field> is already registered (<name>)";
 *  - values held by the same visitor (same _id) mean "update that visitor".
 */

const mongoose = require('mongoose');
const Visitor = require('../../models/visitor.js');
const { conflict, notFound, badRequest, isDuplicateKey } = require('./errors.js');
const { validateVisitorInput } = require('./normalize.js');

const FIELD_LABELS = {
    identification: 'identification number',
    telephone: 'telephone',
    email: 'email',
};

// Identity priority: the ID number decides who the person is, then the
// telephone, then the email.
const UNIQUE_FIELDS = [
    { field: 'identification', path: 'identification.number', read: (input) => input.identification && input.identification.number },
    { field: 'telephone', path: 'telephone', read: (input) => input.telephone },
    { field: 'email', path: 'email', read: (input) => input.email },
];

const readPath = (doc, path) => path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), doc);

const userStamp = (user) => ({
    user_id: user ? String(user.id || user._id || user.userId || '') : '',
    name: user ? (user.name || user.full_name || user.fullName || '') : '',
});

function conflictError({ field, visitor }) {
    return conflict(`Someone with this ${FIELD_LABELS[field]} is already registered (${visitor.full_name || 'another visitor'})`, {
        code: 'VISITOR_CONFLICT',
        field,
        existing: { _id: visitor._id, full_name: visitor.full_name || '' },
    });
}

/**
 * [{ field, visitor }] for every unique value of `input` that belongs to a
 * visitor other than `excludeId`. One query for all fields.
 */
async function findMatches(input, excludeId = null) {
    const checks = UNIQUE_FIELDS
        .map((spec) => ({ ...spec, value: spec.read(input) }))
        .filter((spec) => !!spec.value);
    if (checks.length === 0) return [];

    const filter = { $or: checks.map((spec) => ({ [spec.path]: spec.value })) };
    if (excludeId) filter._id = { $ne: excludeId };

    const found = await Visitor.find(filter)
        .select('full_name identification telephone email gender Is_In_House N_visits createdAt updatedAt')
        .lean();

    return checks
        .map((spec) => ({ field: spec.field, visitor: found.find((doc) => readPath(doc, spec.path) === spec.value) }))
        .filter((match) => !!match.visitor);
}

/** Lookup used to pre-fill forms: who owns these values, and do they clash. */
async function lookupVisitor(input, excludeId = null) {
    const matches = await findMatches(input, excludeId);
    const ids = [...new Set(matches.map((m) => String(m.visitor._id)))];
    return {
        visitor: ids.length === 1 ? matches[0].visitor : (matches[0] ? matches[0].visitor : null),
        matches,
        conflict: ids.length > 1,
    };
}

function applyInput(visitor, input, user) {
    let changed = false;
    const set = (path, value) => {
        const current = readPath(visitor, path);
        if ((current || undefined) !== (value || undefined)) {
            visitor.set(path, value === undefined ? undefined : value);
            changed = true;
        }
    };
    set('full_name', input.full_name);
    set('telephone', input.telephone);
    set('email', input.email);
    set('gender', input.gender);
    set('identification.id_type', input.identification.id_type);
    set('identification.number', input.identification.number);
    if (changed) visitor.updated_by = userStamp(user);
    return changed;
}

async function saveOrConflict(visitor, input) {
    try {
        await visitor.save();
    } catch (error) {
        if (!isDuplicateKey(error)) throw error;
        // Someone registered the same value in the meantime
        const matches = await findMatches(input, visitor.isNew ? null : visitor._id);
        if (matches.length) throw conflictError(matches[0]);
        throw error;
    }
    return visitor;
}

/**
 * Who a form describes, without writing anything: the existing visitor id,
 * or null for a new person. Throws on invalid input and on conflicts.
 *  - visitorId given (a visitor chosen/pre-filled on the form): that visitor,
 *    as long as no OTHER visitor holds the submitted values;
 *  - no visitorId: the ID number decides who the person is. A known ID
 *    number is that visitor; a new ID number with a telephone or email that
 *    already belongs to someone is a conflict.
 * @returns {Promise<{ targetId: ObjectId|null }>}
 */
async function identifyVisitor({ visitorId = null, input }) {
    const errors = validateVisitorInput(input);
    if (errors.length) {
        throw badRequest(errors[0].message, { code: 'VISITOR_INVALID', field: errors[0].field, errors });
    }

    if (visitorId) {
        if (!mongoose.Types.ObjectId.isValid(visitorId)) throw badRequest('Invalid visitor id');
        const target = await Visitor.findById(visitorId).select('_id').lean();
        if (!target) throw notFound('Visitor not found');
        const others = await findMatches(input, target._id);
        if (others.length) throw conflictError(others[0]);
        return { targetId: target._id };
    }

    const matches = await findMatches(input, null);
    if (matches.length === 0) return { targetId: null };
    const byId = matches.find((m) => m.field === 'identification');
    if (!byId) throw conflictError(matches[0]);
    const clash = matches.find((m) => String(m.visitor._id) !== String(byId.visitor._id));
    if (clash) throw conflictError(clash);
    return { targetId: byId.visitor._id };
}

/**
 * Create or update the visitor a form describes.
 * @returns {Promise<{ visitor, created: boolean, changed: boolean }>}
 */
async function resolveVisitor({ visitorId = null, input, user = null }) {
    const { targetId } = await identifyVisitor({ visitorId, input });

    if (targetId) {
        const target = await Visitor.findById(targetId);
        const changed = applyInput(target, input, user);
        if (changed) await saveOrConflict(target, input);
        return { visitor: target, created: false, changed };
    }

    const created = new Visitor({
        full_name: input.full_name,
        telephone: input.telephone,
        email: input.email,
        gender: input.gender,
        identification: { ...input.identification },
        Is_In_House: false,
        N_visits: 0,
        created_by: userStamp(user),
        updated_by: userStamp(user),
    });
    await saveOrConflict(created, input);
    return { visitor: created, created: true, changed: true };
}

module.exports = {
    FIELD_LABELS,
    findMatches,
    lookupVisitor,
    identifyVisitor,
    resolveVisitor,
    conflictError,
    userStamp,
};
