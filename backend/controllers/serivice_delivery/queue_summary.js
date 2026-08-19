const ServiceDelivery = require('../../models/service_delivery.js');
const Department = require('../../models/department.js');

/**
 * Queue summary based ONLY on the user's department (req.user.department):
 * - units = all departments whose parent_department is the user's department
 * - total_units = count of those units
 * - visitors_in_department / currently_serving = visitors whose assigned
 *   department_id is the user's department OR one of its units
 */
module.exports = async function queue_summary(req, res, next) {
  try {
    let { in_house = 'true' } = req.query || {};

    const user_department_id = req.user?.department?._id?.toString() || null;

    let inHouseFilter = {};
    if (in_house === 'true' || in_house === true) {
      inHouseFilter.is_still_inhouse = true;
    } else if (in_house === 'false' || in_house === false) {
      inHouseFilter.is_still_inhouse = false;
    }

    if (!user_department_id) {
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

    const userDept = req.user.department;

    const units = await Department.find({
      $or: [
        { parent_department: user_department_id },
        { 'sub_department_mng.parent_department_id': String(user_department_id) },
      ],
    }).select('department_name department_id').lean();

    const idsOf = (doc) => {
      const ids = [String(doc._id)];
      if (doc.department_id) ids.push(String(doc.department_id));
      return ids;
    };

    const scopeIds = [
      ...new Set([
        user_department_id,
        ...(userDept?.department_id ? [String(userDept.department_id)] : []),
        ...units.flatMap(idsOf),
      ]),
    ];

    const deptFilter = {
      departments_assigned: {
        $elemMatch: { department_id: { $in: scopeIds } },
      },
      ...inHouseFilter,
    };

    const visitorsInDept = await ServiceDelivery.countDocuments(deptFilter);
    const currentlyServing = await ServiceDelivery.countDocuments({
      ...deptFilter,
      is_being_served: true,
    });

    const unitBreakdown = [];
    for (const unit of units) {
      const unitFilter = {
        departments_assigned: {
          $elemMatch: { department_id: { $in: idsOf(unit) } },
        },
        ...inHouseFilter,
      };

      const totalAssigned = await ServiceDelivery.countDocuments(unitFilter);
      const servingCount = await ServiceDelivery.countDocuments({
        ...unitFilter,
        is_being_served: true,
      });

      unitBreakdown.push({
        unit_id: String(unit._id),
        unit_name: unit.department_name || '',
        total_assigned: totalAssigned,
        currently_serving: servingCount,
      });
    }

    return res.status(200).json({
      success: true,
      type: 'success',
      message: 'Queue summary results',
      is_parent_department: units.length > 0,
      total_units: units.length,
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
