/**
 * Which departments a user works for, as department id strings (the same
 * form departments_assigned.department_id is stored in).
 *  - everyone: their department and their unit (department_unit is a plain
 *    string id on the user);
 *  - head of department: also every department they lead and all units of
 *    those departments (new parent_department and the legacy
 *    sub_department_mng.parent_department_id format).
 */

const Department = require('../../models/department.js');

const userIdOf = (user) => String((user && (user.id || user._id || user.userId)) || '');

function ownDepartmentIds(user) {
    const ids = new Set();
    const dept = user && user.department;
    const deptId = dept && typeof dept === 'object' ? dept._id : dept;
    if (deptId) ids.add(String(deptId));
    if (user && user.department_unit) ids.add(String(user.department_unit));
    return ids;
}

async function ledDepartmentIds(userId) {
    if (!userId) return [];
    const led = await Department.find({ $or: [{ department_leader: userId }, { leader: userId }] })
        .select('_id')
        .lean();
    const ledIds = led.map((d) => d._id);
    if (ledIds.length === 0) return [];
    const units = await Department.find({
        $or: [
            { parent_department: { $in: ledIds } },
            { 'sub_department_mng.parent_department_id': { $in: ledIds.map(String) } },
        ],
    })
        .select('_id')
        .lean();
    return [...ledIds, ...units.map((u) => u._id)].map(String);
}

/**
 * @param {object} user  req.user
 * @param {string} roleSlug  req.navigation.role_slug
 */
async function departmentScopeFor(user, roleSlug = '') {
    const ids = ownDepartmentIds(user);
    if (roleSlug === 'department-manager') {
        (await ledDepartmentIds(userIdOf(user))).forEach((id) => ids.add(id));
    }
    return [...ids];
}

module.exports = {
    userIdOf,
    ownDepartmentIds,
    ledDepartmentIds,
    departmentScopeFor,
};
