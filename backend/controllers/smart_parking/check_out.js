const ServiceDelivery = require("../../models/service_delivery.js");
const ParkingRecord = require("../../models/parking_record.js");
const {
  normalizePlate, activeRecordForPlate, endParkingSession, closeVisit, parkingView, emitVisitorUpdated, whenText,
  sendError, badRequest, notFound, conflict,
} = require("../../utilities/visitors");

/** The visit this car belongs to: the stored link, else (old records) an open visit with this plate. */
async function visitOfRecord(record) {
  if (record.service_delivery) {
    const linked = await ServiceDelivery.findOne({ _id: record.service_delivery, is_still_inhouse: true });
    if (linked) return linked;
  }
  return ServiceDelivery.findOne({
    is_still_inhouse: true,
    "vehicle_storage.has_vehicle": true,
    "vehicle_storage.vehicle_details.plate_number": record.plate_number,
  }).sort({ entry_date: -1 });
}

/**
 * POST /smartparking/vehicle/checkout { plate_number }
 * Ends the parking session and closes the visit of the person who came with it.
 */
module.exports = async function car_check_out(req, res) {
  try {
    const plate = normalizePlate((req.body || {}).plate_number);
    if (!plate) throw badRequest("Plate number required");
    const active = await activeRecordForPlate(plate);
    if (!active) {
      // Not parked: say when it left instead of checking it out twice
      const last = await ParkingRecord.findOne({ plate_number: plate, status: "completed" }).sort({ check_out: -1 }).select("check_out").lean();
      if (last) throw conflict(`Car ${plate} is not parked. It was already checked out at ${whenText(last.check_out)}.`, { code: "ALREADY_CHECKED_OUT" });
      throw notFound("No active parking record found for this plate number.");
    }

    const { record, minutes, violation } = await endParkingSession(active, req.user);

    const visit = await visitOfRecord(record);
    if (visit) {
      const named = await ServiceDelivery.findById(visit._id).populate("visitor", "full_name").lean();
      await closeVisit(visit, {
        visitorName: named && named.visitor ? named.visitor.full_name : "",
        vehicleDuration: `${minutes} mins`,
      });
      global.WebsocketIO?.emit("visitor_checkedout", { show_notif: false, type: "info", message: "A visitor checked out", visitor_id: String(visit.visitor || "") });
    }

    global.WebsocketIO?.emit("car_checkedout", {
      show_notif: !!violation,
      type: violation ? "warning" : "info",
      message: violation ? `Vehicle ${plate} overstayed by ${violation.overstayed_minutes} minutes.` : `Vehicle ${plate} checked out.`,
    });
    if (record.visitor) emitVisitorUpdated(record.visitor);

    const populated = parkingView(await record.populate("visitor"));
    return res.status(200).json({
      success: true,
      type: violation ? "warning" : "success",
      message: violation ? `Vehicle checked out. WARNING: Vehicle overstayed by ${violation.overstayed_minutes} minutes.` : "Vehicle checked out successfully.",
      data: {
        ...populated,
        check_in_time: record.check_in,
        check_out_time: record.check_out,
        total_duration: `${minutes} mins`,
        is_flagged: !!violation,
        violation_details: violation,
      },
    });
  } catch (error) {
    return sendError(res, error, "Failed to check out car");
  }
};
