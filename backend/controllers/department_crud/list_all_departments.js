const department_model = require('../../models/department.js')
const user_model = require('../../models/user.js')

// Main departments: neither the is_unit flag nor the legacy sub_department_mng flag
const MAIN_FILTER = {
    $and: [
        { is_unit: { $ne: true } },
        { $or: [
            { 'sub_department_mng.is_sub_department': { $ne: true } },
            { 'sub_department_mng.is_sub_department': { $exists: false } }
        ] }
    ]
}

// Units in both formats: is_unit + parent_department, or the legacy sub_department_mng block
const UNIT_FILTER = {
    $or: [
        { is_unit: true },
        { 'sub_department_mng.is_sub_department': true }
    ]
}

const LEADER_FIELDS = 'full_name email title'

/** Parent department id of a unit, whichever format the unit uses. */
function parent_id_of(unit) {
    if (unit.parent_department) return String(unit.parent_department._id || unit.parent_department)
    const legacy = unit.sub_department_mng && unit.sub_department_mng.parent_department_id
    return legacy ? String(legacy) : ''
}

/**
 * One aggregation over the employee accounts: how many users carry each
 * (department, department_unit) pair. `department` is the parent ObjectId,
 * `department_unit` is the unit id stored as a string.
 */
async function count_membership_pairs() {
    const rows = await user_model.aggregate([
        { $group: { _id: { department: { $toString: '$department' }, unit: '$department_unit' }, people: { $sum: 1 } } }
    ])
    return rows.map((row) => ({
        department: row._id.department ? String(row._id.department) : '',
        unit: row._id.unit ? String(row._id.unit) : '',
        people: row.people
    }))
}

/**
 * People per unit and per department. A department counts its own people
 * plus the people of its units; every account is counted once.
 */
function people_counts(units, rows) {
    const unit_parent = new Map(units.map((unit) => [String(unit._id), parent_id_of(unit)]))
    const per_unit = new Map()
    const per_department = new Map()
    const add = (map, key, people) => { if (key) map.set(key, (map.get(key) || 0) + people) }
    rows.forEach((row) => {
        add(per_department, row.department, row.people)
        if (!unit_parent.has(row.unit)) return
        add(per_unit, row.unit, row.people)
        const parent = unit_parent.get(row.unit)
        if (parent !== row.department) add(per_department, parent, row.people)
    })
    return { per_unit, per_department }
}

module.exports = async function list_all_departments(req, res, next) {
    try {
        const { limit = 0, page = 1 } = req.query || {}

        // limit=0 (the default) returns every department - no cap, no paging
        const limit_val = Math.max(0, parseInt(limit) || 0)
        const page_val = Math.max(1, parseInt(page) || 1)

        let main_query = department_model.find(MAIN_FILTER).sort({ created_at: -1 })
        if (limit_val > 0) main_query = main_query.skip((page_val - 1) * limit_val).limit(limit_val)

        const [departments, units, rows] = await Promise.all([
            main_query
                .populate('leader', LEADER_FIELDS)
                .populate('department_leader', LEADER_FIELDS)
                .populate('employees', 'full_name email')
                .populate('parent_department', 'department_name')
                .lean(),
            department_model.find(UNIT_FILTER)
                .sort({ department_name: 1 })
                .populate('leader', LEADER_FIELDS)
                .populate('department_leader', LEADER_FIELDS)
                .populate('employees', 'full_name email')
                .lean(),
            count_membership_pairs()
        ])
        const total_count = limit_val > 0 ? await department_model.countDocuments(MAIN_FILTER) : departments.length

        const { per_unit, per_department } = people_counts(units, rows)
        const units_by_parent = new Map()
        units.forEach((unit) => {
            const parent = parent_id_of(unit)
            if (!units_by_parent.has(parent)) units_by_parent.set(parent, [])
            units_by_parent.get(parent).push({ ...unit, employee_count: per_unit.get(String(unit._id)) || 0 })
        })
        const data = departments.map((dept) => ({
            ...dept,
            employee_count: per_department.get(String(dept._id)) || 0,
            sub_departments: units_by_parent.get(String(dept._id)) || []
        }))

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Departments list',
            total: total_count,
            page: page_val,
            totals: { departments: total_count, units: units.length },
            data
        })
    } catch (error) {
        console.error('Error in list_all_departments:', error)
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Something went wrong, try again later',
            error: error.message
        })
    }
}
