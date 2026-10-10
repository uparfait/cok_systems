const ParkingRecord = require("../../models/parking_record.js");
const {
  normalizePlate, classifyPlate, lastDriverForPlate, visitorView, parkingView, sendError, badRequest,
} = require("../../utilities/visitors");

const CATEGORY = { staff: "Staff", visitor: "Visitor", regular: "Regular" };

/** Pre-fill for a driver who is not yet a registered visitor (reservation or staff registry). */
function registryDriver(classification) {
  const reservation = classification.reservation;
  if (reservation) {
    return {
      full_name: reservation.driver_name || "",
      telephone: reservation.telephone_number || "",
      email: "",
      gender: "",
      identification: {
        id_type: (reservation.driver_identification && reservation.driver_identification.id_type) || "",
        number: (reservation.driver_identification && reservation.driver_identification.number) || "",
      },
    };
  }
  const staff = classification.staff_car;
  if (staff) {
    return {
      full_name: staff.owner_name || "",
      telephone: staff.telephone && staff.telephone !== "Not Specified" ? staff.telephone : "",
      email: "",
      gender: "",
      identification: { id_type: staff.id_type || "", number: staff.identification || "" },
    };
  }
  return null;
}

/**
 * POST /smartparking/vehicle/verify { plate_number }
 * Classifies the car and returns the person who came with it last time
 * (editable pre-fill), or the reservation / staff owner when it never parked.
 */
module.exports = async function verify_car(req, res) {
  try {
    const plate = normalizePlate((req.body || {}).plate_number);
    if (!plate) throw badRequest("Plate number is required for verification");

    const [active, classification, lastDriver, everFlagged] = await Promise.all([
      ParkingRecord.findOne({ plate_number: plate, status: "active" }).sort({ check_in: -1 }).populate("visitor").lean(),
      classifyPlate(plate),
      lastDriverForPlate(plate),
      ParkingRecord.exists({ plate_number: plate, $or: [{ flagged_at: { $ne: null } }, { is_flagged: true }] }),
    ]);

    const last = lastDriver ? visitorView(lastDriver) : null;
    const prefill = last || registryDriver(classification);
    const found = !!(last || classification.staff_car || classification.reservation);

    return res.status(200).json({
      success: found,
      type: found ? "success" : "warning",
      message: found ? "Vehicle verified successfully" : "Vehicle not found in system",
      data: {
        plate_number: plate,
        is_currently_parked: !!active,
        parking_details: active ? parkingView(active) : null,
        vehicle_category: CATEGORY[classification.driver_type],
        driver_type: classification.driver_type,
        is_flagged: !!(active && active.is_flagged),
        was_ever_flagged: !!everFlagged,
        is_reserved: classification.driver_type !== "regular",
        staff_details: classification.staff_car ? { ...classification.staff_car, is_active: true } : null,
        emergency_reservation_details: classification.reservation || null,
        last_driver: last,
        visitor_id: last ? last._id : null,
        driver: prefill,
        driver_details: {
          name: prefill ? prefill.full_name : null,
          telephone: prefill ? prefill.telephone : null,
          gender: prefill ? prefill.gender : null,
          identification: prefill ? prefill.identification : null,
          type: CATEGORY[classification.driver_type],
          email: prefill ? prefill.email : null,
        },
      },
    });
  } catch (error) {
    return sendError(res, error, "Something went wrong while verifying the car");
  }
};
