/**
 * Response shapes. The database keeps a person only in the Visitor model;
 * responses still carry the flat fields screens have always read
 * (full_name, telephone, driver_name...) next to the populated visitor, so
 * every consumer reads the same values from one place.
 */

const toPlain = (doc) => {
    if (!doc) return null;
    if (typeof doc.toObject === 'function') return doc.toObject();
    return { ...doc };
};

const isPopulated = (value) => !!value && typeof value === 'object' && (value.full_name !== undefined || value.telephone !== undefined);

function visitorView(visitor) {
    const v = toPlain(visitor);
    if (!v) return null;
    return {
        _id: v._id,
        identification: {
            id_type: (v.identification && v.identification.id_type) || '',
            number: (v.identification && v.identification.number) || '',
        },
        full_name: v.full_name || '',
        telephone: v.telephone || '',
        email: v.email || '',
        gender: v.gender || '',
        Is_In_House: !!v.Is_In_House,
        N_visits: v.N_visits || 0,
        createdAt: v.createdAt || null,
        updatedAt: v.updatedAt || null,
    };
}

/**
 * Person fields for a visit or parking row. Records of the old structure
 * have no visitor reference; their own legacy fields are used as a fallback
 * so they still display until the admin cleans them up.
 */
function personOf(doc, legacy = {}) {
    const populated = isPopulated(doc.visitor) ? visitorView(doc.visitor) : null;
    if (populated) return populated;
    return {
        _id: null,
        identification: legacy.identification || { id_type: '', number: '' },
        full_name: legacy.full_name || '',
        telephone: legacy.telephone || '',
        email: legacy.email || '',
        gender: legacy.gender || '',
        Is_In_House: false,
        N_visits: 0,
    };
}

/** Who is serving right now: the lock holder, else the in-progress entry. */
function servingOf(visit) {
    if (!visit || !visit.is_being_served) return null;
    if (visit.current_server && visit.current_server.user_id) return visit.current_server;
    const entry = (visit.services_status || []).find((s) => s.s_type === 'Inprogress');
    if (!entry) return null;
    return {
        user_id: entry.provider_id || null,
        name: entry.provider_name || '',
        email: '',
        department_id: entry.department_id || null,
        department_name: entry.department_name || '',
        started_at: null,
    };
}

function visitView(visit, { withAttachments = false } = {}) {
    const o = toPlain(visit);
    if (!o) return null;
    const person = personOf(o, {
        identification: o.identification,
        full_name: o.full_name,
        telephone: o.telephone,
        email: o.email,
        gender: o.gender,
    });
    const attachments = Array.isArray(o.attachments) ? o.attachments : [];
    const view = {
        ...o,
        visitor: person,
        visitor_id: person._id,
        full_name: person.full_name,
        telephone: person.telephone,
        email: person.email,
        gender: person.gender,
        identification: person.identification,
        N_visits: person.N_visits,
        Is_In_House: person.Is_In_House,
        serving_by: servingOf(o),
        attachments_count: attachments.length,
    };
    delete view.badge_number;
    delete view.driver_identification;
    if (!withAttachments) delete view.attachments;
    return view;
}

function parkingView(record) {
    const o = toPlain(record);
    if (!o) return null;
    const person = personOf(o, {
        identification: o.driver_identification,
        full_name: o.driver_name,
        telephone: o.driver_telephone,
        email: o.driver_email,
        gender: o.driver_gender,
    });
    const view = {
        ...o,
        visitor: person,
        visitor_id: person._id,
        driver_name: person.full_name,
        driver_telephone: person.telephone,
        driver_email: person.email,
        driver_gender: person.gender,
        driver_identification: person.identification,
        N_visits: person.N_visits,
        Is_In_House: person.Is_In_House,
    };
    delete view.badge_number;
    return view;
}

module.exports = {
    toPlain,
    isPopulated,
    visitorView,
    visitView,
    parkingView,
    servingOf,
};
