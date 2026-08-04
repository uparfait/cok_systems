const ServiceDelivery = require('../../models/service_delivery.js');
const Department = require('../../models/department.js');
const { getDepartmentIdsForHead } = require('../department_flow/visitors_by_status.js');

/**
 * Get queue summary for the current user's department.
 *
 * Uses the SAME department + assigned_by.user_id filtering as
 * get_visitors_by_provider_current.js so that visitor counts match the table.
 *
 * For Employees:
 *   - Collects department ids from req.user.department._id and req.user.department_unit
 *   - If the employee's department is a parent: total_units = count of its sub-departments
 *   - If not a parent: total_units = 0
 *   - visitors_in_department = count of in-house visitors matching the filter
 *   - currently_serving = count of those visitors with is_being_served=true
 */
module.exports = async function queue_summary(req, res, next) {
  try {
    let { in_house = 'true' } = req.query || {};

    let user_role_name = req.user?.role_name;
    let user_department_id = req.user?.department?._id?.toString() || null;
    let user_department_unit_id = req.user?.department_unit?.toString() || null;

    // Same department ID collection as get_visitors_by_provider_current.js
    let departmentIds = [];
    if (user_department_id) departmentIds.push(user_department_id);
    if (user_department_unit_id) departmentIds.push(user_department_unit_id);

    // HODs may lead departments without being a member of one — resolve from
    // department leadership (includes sub-departments) when nothing was found
    if (user_role_name === 'Head of department') {
      const ledIds = await getDepartmentIdsForHead(req.user?.userId || req.user?.id);
      ledIds.forEach((id) => { if (!departmentIds.includes(id)) departmentIds.push(id); });
    }

    if (departmentIds.length === 0) {
      return res.status(200).json({
        success: true,
        type: "success",
        message: "Queue summary results",
        is_parent_department: false,
        total_units: 0,
        visitors_in_department: 0,
        currently_serving: 0,
        units: [],
      });
    }

    // in_house filter: true = only in-house, false = only checked-out, absent = all
    let inHouseFilter = {};
    if (in_house === 'true' || in_house === true) {
      inHouseFilter.is_still_inhouse = true;
    } else if (in_house === 'false' || in_house === false) {
      inHouseFilter.is_still_inhouse = false;
    }

    // Fetch all departments to resolve parent/sub-department relationships
    const allDepartments = await Department.find({});

    // Determine the parent department among the employee's department ids
    let parentDepartmentId = null;
    let isParentDepartment = false;

    for (const deptId of departmentIds) {
      const dept = allDepartments.find((d) => String(d._id) === String(deptId));
      if (!dept) continue;

      const isSubDeptLegacy =
        (dept.sub_department_mng?.is_sub_department === true ||
          dept.sub_department_mng?.is_sub_department === 'true');
      const isSubDeptNew =
        dept.is_unit === true || dept.is_unit === 'true' || dept.is_unit === 1;

      if (isSubDeptLegacy) {
        parentDepartmentId = String(dept.sub_department_mng?.parent_department_id);
        break;
      } else if (isSubDeptNew && dept.parent_department) {
        parentDepartmentId = String(dept.parent_department);
        break;
      } else {
        // This is a parent/main department
        parentDepartmentId = String(dept._id);
        isParentDepartment = true;
        break;
      }
    }

    if (!parentDepartmentId) {
      parentDepartmentId = departmentIds[0];
    }

    // Find all sub-departments (units) of the parent department
    // Support both new format (is_unit + parent_department) and legacy (sub_department_mng)
    const subDepts = allDepartments.filter((dept) => {
      const isSubLegacy =
        (dept.sub_department_mng?.is_sub_department === true ||
          dept.sub_department_mng?.is_sub_department === 'true') &&
        String(dept.sub_department_mng?.parent_department_id) === String(parentDepartmentId);

      const isSubNew =
        (dept.is_unit === true || dept.is_unit === 'true' || dept.is_unit === 1) &&
        dept.parent_department &&
        String(dept.parent_department) === String(parentDepartmentId);

      return isSubLegacy || isSubNew;
    });

    // Base filter: EXACTLY matches get_visitors_by_provider_current.js for Employee role
    const deptFilter = {
      'departments_assigned': {
        $elemMatch: {
          department_id: { $in: departmentIds },
        },
      },
      ...inHouseFilter,
    };

    // Count all in-house visitors assigned to this employee's departments
    const visitorsInDept = await ServiceDelivery.countDocuments(deptFilter);

    // Count visitors currently being served
    const currentlyServing = await ServiceDelivery.countDocuments({
      ...deptFilter,
      is_being_served: true,
    });

    // Per-unit breakdown (only for parent departments)
    const unitBreakdown = [];
    if (isParentDepartment) {
      for (const subDept of subDepts) {
        const subDeptId = String(subDept._id);
        const unitFilter = {
          'departments_assigned': {
            $elemMatch: { department_id: subDeptId },
          },
          ...inHouseFilter,
        };

        const totalAssigned = await ServiceDelivery.countDocuments(unitFilter);
        const servingCount = await ServiceDelivery.countDocuments({
          ...unitFilter,
          is_being_served: true,
        });

        unitBreakdown.push({
          unit_id: subDeptId,
          unit_name: subDept.department_name || subDept.name || '',
          total_assigned: totalAssigned,
          currently_serving: servingCount,
        });
      }
    }

    const totalUnits = isParentDepartment ? subDepts.length : 0;

    return res.status(200).json({
      success: true,
      type: 'success',
      message: 'Queue summary results',
      is_parent_department: isParentDepartment,
      total_units: totalUnits,
      visitors_in_department: visitorsInDept,
      currently_serving: currentlyServing,
      units: isParentDepartment ? unitBreakdown : [],
    });
  } catch (error) {
    console.error('Error in queue_summary:', error);
    return res.status(500).json({
      success: false,
      type: 'error',
      message: 'Something went wrong while retrieving queue summary',
      error: error.message,
    });
  }
};
