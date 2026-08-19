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

/**
 * Resolves where a user sits in the org: the id may point at a top-level
 * department or at a unit, so this returns both the top-level department id
 * and the unit id (null when the user sits directly in the department).
 */
async function get_department_context(department_id) {
  const object_id = to_object_id(department_id);
  if (!object_id) return null;

  const document = await get_cok_db()
    .collection("departments")
    .findOne({ _id: object_id }, { projection: { is_unit: 1, parent_department: 1, sub_department_mng: 1 } });
  if (!document) return null;

  const is_unit = document.is_unit === true || document.sub_department_mng?.is_sub_department === true;
  if (!is_unit) {
    return { department_id: department_id.toString(), unit_id: null };
  }

  const parent_id = document.parent_department
    ? document.parent_department.toString()
    : document.sub_department_mng?.parent_department_id || null;
  return { department_id: parent_id, unit_id: department_id.toString() };
}

module.exports = {
  list_departments,
  list_department_units,
  get_department_context,
};
