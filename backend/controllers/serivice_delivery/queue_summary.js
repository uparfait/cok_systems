const ServiceDelivery = require('../../models/service_delivery.js');
const Department = require('../../models/department.js');


module.exports = async function queue_summary(req, res, next) {
  try {
    let { in_house = 'true' } = req.query || {};

    const user_department_id = req.user?.department?._id?.toString() || null;
    const user_department_unit_id = req.user?.department_unit?.toString() || null;

    let inHouseFilter = {};
    if (in_house === 'true' || in_house === true) {
      inHouseFilter.is_still_inhouse = true;
    } else if (in_house === 'false' || in_house === false) {
      inHouseFilter.is_still_inhouse = false;
    }

    const allDepartments = await Department.find({});
    const findDept = (id) =>
      allDepartments.find(
        (d) => String(d._id) === String(id) || (d.department_id && String(d.department_id) === String(id))
      );
    const isUnitDoc = (d) =>
      !!d &&
      (d.is_unit === true || d.is_unit === 'true' || d.is_unit === 1 ||
        d.sub_department_mng?.is_sub_department === true ||
        d.sub_department_mng?.is_sub_department === 'true');
    const unitsOf = (parent) => {
      const parentIds = [String(parent?._id), parent?.department_id ? String(parent.department_id) : null].filter(Boolean);
      return allDepartments.filter(
        (d) =>
          isUnitDoc(d) &&
          ((d.parent_department && parentIds.includes(String(d.parent_department))) ||
            (d.sub_department_mng?.parent_department_id &&
              parentIds.includes(String(d.sub_department_mng.parent_department_id))))
      );
    };
    const idsOf = (doc, fallbackId) => {
      const ids = [];
      if (doc) {
        ids.push(String(doc._id));
        if (doc.department_id) ids.push(String(doc.department_id));
      } else if (fallbackId) {
        ids.push(String(fallbackId));
      }
      return ids;
    };

    let baseDoc = null;
    let unitMode = false;

    // department_unit often holds placeholder text like "Not specified" —
    // only trust it when it resolves to a real department document
    const unitDoc = user_department_unit_id ? findDept(user_department_unit_id) : null;

    if (unitDoc) {
      baseDoc = unitDoc;
      unitMode = true;
    } else if (user_department_id) {
      baseDoc = findDept(user_department_id) || { _id: user_department_id };
      unitMode = isUnitDoc(baseDoc);
    }

    if (!baseDoc) {
      return res.status(200).json({
        success: true,
        type: 'success',
        message: 'Queue summary results',
        is_parent_department: false,
        total_units: 0,
        visitors_in_department: 0,
        currently_serving: 0,
        units: [],
      });
    }

    const subDepts = unitMode ? [] : unitsOf(baseDoc);
    const scopeIds = [
      ...idsOf(baseDoc, baseDoc._id),
      ...subDepts.flatMap((u) => idsOf(u)),
    ];
    const uniqueScopeIds = [...new Set(scopeIds)];

    const deptFilter = {
      departments_assigned: {
        $elemMatch: { department_id: { $in: uniqueScopeIds } },
      },
      ...inHouseFilter,
    };

    const visitorsInDept = await ServiceDelivery.countDocuments(deptFilter);
    const currentlyServing = await ServiceDelivery.countDocuments({
      ...deptFilter,
      is_being_served: true,
    });

    const unitBreakdown = [];
    for (const subDept of subDepts) {
      const unitIds = [...new Set(idsOf(subDept))];
      const unitFilter = {
        departments_assigned: {
          $elemMatch: { department_id: { $in: unitIds } },
        },
        ...inHouseFilter,
      };

      const totalAssigned = await ServiceDelivery.countDocuments(unitFilter);
      const servingCount = await ServiceDelivery.countDocuments({
        ...unitFilter,
        is_being_served: true,
      });

      unitBreakdown.push({
        unit_id: String(subDept._id),
        unit_name: subDept.department_name || subDept.name || '',
        total_assigned: totalAssigned,
        currently_serving: servingCount,
      });
    }

    return res.status(200).json({
      success: true,
      type: 'success',
      message: 'Queue summary results',
      is_parent_department: !unitMode,
      total_units: unitMode ? 0 : subDepts.length,
      visitors_in_department: visitorsInDept,
      currently_serving: currentlyServing,
      units: unitBreakdown,
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
