/**
 * What the caller may do with one visitor, by role:
 *  - employee: serve, complete (only the one serving), transfer;
 *  - every other role: send to department;
 *  - everyone: edit details while in house, add attachments when the
 *    visitor has a visit.
 */

const { servingOf } = require('../../utilities/visitors/serialize.js');
const { userIdOf } = require('../../utilities/visitors/scope.js');

const roleSlugOf = (req) => String((req.navigation && req.navigation.role_slug) || '').toLowerCase();
const isEmployee = (req) => roleSlugOf(req) === 'employee';

function permissionsFor(req, { openVisit = null, hasVisit = false } = {}) {
    const me = userIdOf(req.user);
    const inHouse = !!openVisit;
    const server = openVisit ? servingOf(openVisit) : null;
    const servedByMe = !!server && String(server.user_id || '') === me;
    const employee = isEmployee(req);
    return {
        role_slug: roleSlugOf(req),
        can_edit: inHouse,
        can_serve: employee && inHouse && !openVisit.is_being_served,
        can_complete: employee && inHouse && !!openVisit.is_being_served && servedByMe,
        can_transfer: employee && inHouse && (!openVisit.is_being_served || servedByMe),
        can_send: !employee && inHouse && !openVisit.is_being_served,
        can_add_attachment: hasVisit,
        serving_by: server,
    };
}

module.exports = {
    roleSlugOf,
    isEmployee,
    permissionsFor,
};
