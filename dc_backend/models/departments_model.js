const { get_cok_db } = require("../db_connection/db.js");
const { to_object_id } = require("../utilities/object_id.js");

/**
 * Reads top-level departments from the main system's database (read-only).
 * Mirrors the same "main department" filter the main backend uses so this
 * system never drifts from the source of truth.
 */
async function list_departments() {
  const departments = await get_cok_db()
    .collection("departments")
    .find(
      {
        is_unit: { $ne: true },
        $or: [
          { "sub_department_mng.is_sub_department": { $ne: true } },
          { "sub_department_mng.is_sub_department": { $exists: false } },
        ],
      },
      { projection: { department_name: 1 } },
    )
    .sort({ department_name: 1 })
    .toArray();

  return departments.map((department) => ({
    id: department._id.toString(),
    name: department.department_name,
  }));
}

/**
 * Reads the units (sub-departments) belonging to a given department id,
 * supporting both the current and legacy sub-department shapes.
 */
async function list_department_units(department_id) {
  const object_id = to_object_id(department_id);

  const units = await get_cok_db()
    .collection("departments")
    .find(
      {
        $or: [
          { is_unit: true, parent_department: object_id },
          { "sub_department_mng.is_sub_department": true, "sub_department_mng.parent_department_id": department_id.toString() },
        ],
      },
      { projection: { department_name: 1 } },
    )
    .sort({ department_name: 1 })
    .toArray();

  return units.map((unit) => ({
    id: unit._id.toString(),
    name: unit.department_name,
  }));
}

module.exports = {
  list_departments,
  list_department_units,
};
