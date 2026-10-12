/**
 * GET /statistics/admin-dashboard
 * The figures on the admin home cards, all counted here: departments and
 * units, employee accounts, cars inside and flagged, visitors in house,
 * registered and returning, and today's visits.
 */

const Department = require('../../models/department.js');
const User = require('../../models/user.js');
const ParkingRecord = require('../../models/parking_record.js');
const Visitor = require('../../models/visitor.js');
const ServiceDelivery = require('../../models/service_delivery.js');

const UNIT = { $or: [{ is_unit: true }, { 'sub_department_mng.is_sub_department': true }] };
const MAIN = { $and: [{ is_unit: { $ne: true } }, { 'sub_department_mng.is_sub_department': { $ne: true } }] };

const startOfToday = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

async function getAdminDashboard(req, res) {
    try {
        const [departments, units, employees, carsInside, flaggedCars, visitorsInHouse, registered, returning, visitsToday] = await Promise.all([
            Department.countDocuments(MAIN),
            Department.countDocuments(UNIT),
            User.countDocuments({}),
            ParkingRecord.countDocuments({ status: 'active' }),
            ParkingRecord.countDocuments({ status: 'active', is_flagged: true }),
            Visitor.countDocuments({ Is_In_House: true }),
            Visitor.countDocuments({}),
            Visitor.countDocuments({ N_visits: { $gt: 1 } }),
            ServiceDelivery.countDocuments({ entry_date: { $gte: startOfToday() } }),
        ]);
        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Admin dashboard figures',
            data: {
                departments,
                units,
                employees,
                cars_inside: carsInside,
                flagged_cars: flaggedCars,
                visitors_in_house: visitorsInHouse,
                registered_visitors: registered,
                returning_visitors: returning,
                visits_today: visitsToday,
            },
        });
    } catch (error) {
        console.error('Error in getAdminDashboard:', error);
        return res.status(500).json({ success: false, type: 'error', message: 'Failed to load the dashboard figures', error: error.message });
    }
}

module.exports = { getAdminDashboard };
