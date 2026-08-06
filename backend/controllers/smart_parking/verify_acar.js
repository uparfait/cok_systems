const StaffCar = require("../../models/staff_car.js");
const EmergencyCar = require("../../models/emergency_car.js");
const ParkingRecord = require("../../models/parking_record.js");

module.exports = async function verify_car(req, res, next) {
  let plate_number = null;
  let vehicle_type = "Unknown";
  let is_reserved = false;
  let is_found_in_system = false;

  try {
    ({ plate_number = null } = req.body || {});

    if (!plate_number) {
      return res.status(400).json({
        success: false,
        type: "warning",
        message: "Plate number is required for verification",
      });
    }

    const cleanPlateNumber = (plate) => plate?.replace(/\s/g, '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || '';
    plate_number = cleanPlateNumber(plate_number);

    // Check if it's currently parked - get the MOST RECENT active record
    const active_parking = await ParkingRecord.findOne({
      plate_number,
      status: "active",
    }).sort({ check_in: -1 });

    //  Check if it's a registered Staff Car (for active).
    // Staff reservations honor the same window when one is set (nulls = permanent).
    const staff_now = new Date();
    const staff_car = await StaffCar.findOne({
      plate_number,
      is_active: true,
      $and: [
        { $or: [{ valid_from: null }, { valid_from: { $lte: staff_now } }] },
        { $or: [{ valid_until: null }, { valid_until: { $gte: staff_now } }] },
      ],
    });

    //  Check if it's a reserved Emergency/Visitor Car
    // We look inside the visitor_info array of the EmergencyCar model.
    // Reservations never expire: they stay valid until used (vehicle checked in) or cancelled.

    // A visitor reservation only counts INSIDE its window (Start Date → End Date);
    // outside the window the vehicle is treated as a regular arrival.
    const now_ts = new Date();
    const emergency_reservation = await EmergencyCar.findOne({
      is_active: true,
      visitor_info: {
        $elemMatch: {
          plate_number,
          is_used: { $ne: true },
          is_cancelled: { $ne: true },
          // null sides are open-ended
          $and: [
            { $or: [{ valid_from: null }, { valid_from: { $lte: now_ts } }] },
            { $or: [{ valid_until: null }, { valid_until: { $gte: now_ts } }] },
          ],
        },
      },
    });

    console.log("Emergency reservation found:", emergency_reservation);

    // check if is flagged.

    const is_flagged = await ParkingRecord.findOne({
      plate_number,
      is_flagged: true,
      status: "active",
    });

    // Check if vehicle was ever flagged in the past (even if checked out now)
    const was_ever_flagged = await ParkingRecord.findOne({
      plate_number,
      is_flagged: true,
    });

    // also check if it was parked before and provide vistor info

    let driver_name = null;
    let driver_telephone = null;
    let driver_gender = null;
    let driver_identification = null;

    let driver_type = null;
    let driver_email = null;

    // also check if it was parked before and provide visitor info
    let past_parking = null;
    try {
      past_parking = await ParkingRecord.findOne({ plate_number }).sort({
        check_in: -1,
      });
    } catch (err) {
      console.error("Error finding past parking:", err);
    }

    if (past_parking) {
      driver_name = past_parking.driver_name || null;
      driver_telephone = past_parking.driver_telephone || null;
      driver_gender = past_parking.driver_gender || null;
      driver_identification = past_parking.driver_identification || null;
      driver_type = past_parking.driver_type || null;
      driver_email = past_parking.driver_email || null;
    }

    // Determine vehicle type and if vehicle is found in system
    vehicle_type = "Unknown";
    is_reserved = false;
    is_found_in_system = false;

    if (staff_car) {


    // check if still active



      vehicle_type = "Staff";
      is_reserved = true; // Only reserve if active
      is_found_in_system = true;
      driver_type = "Staff"; // Set driver_type for staff cars

      // Extract driver details from staff_car (owner_name is the driver name)
      if (staff_car.owner_name) {
        driver_name = staff_car.owner_name;
      }
      if (staff_car.telephone) {
        driver_telephone = staff_car.telephone;
      }
      if (staff_car.gender) {
        driver_gender = staff_car.gender;
      }
      if (staff_car.email) {
        driver_email = staff_car.email;
      }
      if (staff_car.id_type || staff_car.identification) {
        driver_identification = {
          id_type: staff_car.id_type,
          number: staff_car.identification,
        };
      }
    } else if (emergency_reservation) {
      vehicle_type = driver_type || "Visitor";
      is_reserved = true;
      is_found_in_system = true;
      driver_type = "Visitor"; // Set driver_type for visitor reservations

      // Extract driver details from emergency_reservation visitor_info
      const visitorInfo = emergency_reservation.visitor_info?.find(
        (v) => v.plate_number === plate_number && !v.is_used && !v.is_cancelled &&
          (!v.valid_from || v.valid_from <= now_ts) &&
          (!v.valid_until || v.valid_until >= now_ts),
      );
      console.log("Found visitorInfo:", visitorInfo);
      if (visitorInfo) {
        driver_name = visitorInfo.driver_name || driver_name;
        driver_telephone = visitorInfo.telephone_number || driver_telephone;
        driver_gender = visitorInfo.driver_gender || driver_gender;
        driver_identification =
          visitorInfo.driver_identification || driver_identification;
      }
      console.log("Driver name after extraction:", driver_name);
      console.log("Driver telephone after extraction:", driver_telephone);
    } else if (driver_telephone) {
      vehicle_type = driver_type || "Visitor";
      is_found_in_system = true;
    }

    // If vehicle is not found in system at all, return success: false
    if (!is_found_in_system) {
      return res.status(200).json({
        success: false,
        type: "warning",
        message: "Vehicle not found in system",
        data: {
          plate_number,
          is_currently_parked: false,
          parking_details: null,
          vehicle_category: "Unknown",
          is_flagged: !!is_flagged,
          was_ever_flagged: !!was_ever_flagged,
          is_reserved: false,
          staff_details: null,
          emergency_reservation_details: null,
          driver_details: {
            name: null,
            telephone: null,
            gender: null,
            identification: null,
            type: null,
            email: null,
          },
        },
      });
    }

    return res.status(200).json({
      success: true,
      type: "success",
      message: "Vehicle verified successfully",
      data: {
        plate_number,
        is_currently_parked: !!active_parking,
        parking_details: active_parking || null,
        vehicle_category: driver_type,
        is_flagged: !!is_flagged,
        was_ever_flagged: !!was_ever_flagged,
        is_reserved: is_reserved || false,
        staff_details: staff_car
          ? {
              ...staff_car.toObject(),
              is_active: true,
            }
          : null,
        emergency_reservation_details:
          emergency_reservation?.visitor_info || null,
        driver_details: {
          name: driver_name || null,
          telephone: driver_telephone || null,
          gender: driver_gender || null,
          identification: driver_identification || null,
          type: driver_type || null,
          email: driver_email || null,
        },
      },
    });
  } catch (error) {
    console.error("Error in verify_car:", error);
    return res.status(500).json({
      success: false,
      type: "error",
      message: "Something went wrong while verifying the car",
      error: error?.message,
      data: {
        plate_number: plate_number || null,
        vehicle_category: "Unknown",
        is_currently_parked: false,
        is_flagged: false,
        was_ever_flagged: false,
        is_reserved: false,
        driver_details: {
          name: null,
          telephone: null,
          gender: null,
          identification: null,
          type: null,
          email: null,
        },
      },
    });
  }
};
