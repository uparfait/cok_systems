const ParkingRecord = require("../../models/parking_record.js");
const ServiceDelivery = require("../../models/service_delivery.js");
const ServiceTracking = require("../../models/service_tracking.js");
const StaffCar = require("../../models/staff_car.js");
const FlaggedVehicle = require("../../models/flagged_vehicle.js");
const ParkingSlot = require("../../models/parking_slots.js");
module.exports = async function car_check_out(req, res, next) {
  try {
    let { plate_number = null } = req.body || {};
    let falleged_when_out = false;
    let violation_details = null;

    if (!plate_number) {
      return res
        .status(400)
        .json({
          success: false,
          type: "warning",
          message: "Plate number required",
        });
    }

    plate_number = plate_number.toString().toUpperCase().replace(/\s+/g, "");

    // Find ALL active parking sessions for this plate
    const active_sessions = await ParkingRecord.find({
      plate_number,
      status: "active",
    }).sort({ check_in: -1 });

    if (!active_sessions || active_sessions.length === 0) {
      return res.status(404).json({
        success: false,
        type: "warning",
        message: "No active parking record found for this plate number.",
      });
    }

    // If multiple active records exist, complete all but the most recent one
    if (active_sessions.length > 1) {
      console.log(
        `[WARNING] Found ${active_sessions.length} active records for plate ${plate_number}. Completing all duplicates.`,
      );
      const duplicateCompletionTime = new Date();

      // Complete all but the first (most recent) record
      for (let i = 1; i < active_sessions.length; i++) {
        const duplicate = active_sessions[i];
        const parked_minutes = Math.round(
          (duplicateCompletionTime - new Date(duplicate.check_in)) / 60000,
        );
        duplicate.status = "completed";
        duplicate.check_out = duplicateCompletionTime;
        duplicate.duration = `${parked_minutes} mins`;
        await duplicate.save();
      }
    }

    // Use the most recent active parking session
    const parking_session = active_sessions[0];

    const current_time = new Date();
    const check_in_time = new Date(parking_session.check_in); // added this line for checkin time
    const parked_minutes = Math.round(
      (current_time - new Date(parking_session.check_in)) / 60000,
    );

    // Finalize parking record
    parking_session.status = "completed";
    parking_session.check_out = current_time;
    parking_session.duration = `${parked_minutes} mins`;

    await parking_session.save();

    const pending_visitor = await ServiceDelivery.findOne({
      $or: [
        {
          "vehicle_storage.has_vehicle": true,
          "vehicle_storage.vehicle_details.plate_number": plate_number,
        },
        {
          "vehicle_storage.has_vehicle": false,
          full_name: parking_session.driver_name,
          is_still_inhouse: true,
        },
      ],
    });

    if (pending_visitor) {
      pending_visitor.is_still_inhouse = false;

      // Only update vehicle details if they have a vehicle
      if (
        pending_visitor.vehicle_storage?.has_vehicle &&
        pending_visitor.vehicle_storage?.vehicle_details
      ) {
        pending_visitor.vehicle_storage.vehicle_details.exited_time =
          current_time;
        pending_visitor.vehicle_storage.vehicle_details.duration = `${parked_minutes} mins`;
      }

      // check if there is any working service and desable it as below codes doese

      // cancled all active services and store into service tracking if ignored use as above code

      let active_services = pending_visitor.services_status.filter(
        (s) => s.s_type === "Inprogress",
      );
      for (let active_service of active_services) {
        const current_time = new Date();
        const assigned_dept = pending_visitor.departments_assigned.find(
          (d) => d.department_id === active_service.department_id,
        );
        const start_time = assigned_dept
          ? assigned_dept.assigned_time
          : pending_visitor.entry_date;
        const duration_minutes = Math.round(
          (current_time - new Date(start_time)) / 60000,
        );
        const duration_str = `${duration_minutes} mins`;

        //  Save to ServiceTracking Model
        await ServiceTracking.create({
          department_id: active_service.department_id,
          department_name: active_service.department_name,
          duration: duration_str,
          started_at: start_time,
          ended_at: current_time,
          provider_name: active_service.provider_name || "Not specified",
          provider_id: active_service.provider_id || "Not specified",
        });

        // check if provider id exists and announce to him/her that forgot too stop service but stopped

        if (active_service.provider_id) {
          global.WebsocketIO?.emit("you_forgot_to_stop_service", {
            show_notif: true,
            type: "warning",
            to: active_service.provider_id,
            visitor_id: pending_visitor._id,
            message: `You forgot to stop the service for visitor ${pending_visitor.full_name} in department ${active_service.department_name}. We stopped it for you but please be careful next time.`,
          });
        }

        // Update the service status to 'Completed'
        active_service.s_type = "Completed";
      }

      await pending_visitor.save();
    }

    // ================================================================
    //  AUTOMATED FLAGGING LOGIC
    // ================================================================

    let allowed_duration_minutes = 480; // 8 hours for visitors
    let is_flagged = false;
    let final_message = "Vehicle checked out successfully.";
    // Determine if it's staff to override the allowed time
    if (!pending_visitor) {
      const staff_member = await StaffCar.findOne({ plate_number });
      if (staff_member) {
        allowed_duration_minutes = 720; // 12 hours for staff
      }
    }

    // Do the math: Did they overstay?
    if (parked_minutes > allowed_duration_minutes) {
      const flagged_duration = parked_minutes - allowed_duration_minutes;
      const exact_flagged_time = new Date(
        check_in_time.getTime() + allowed_duration_minutes * 60000,
      );

      // Save the permanent receipt, copying rich data from parking_session!
      const violation = new FlaggedVehicle({
        plate_number: plate_number,

        // Copying context from the original parking record
        driver_type: parking_session.driver_type || "Visitor", // Fallback just in case
        driver_name: parking_session.driver_name,
        driver_telephone: parking_session.driver_telephone,
        driver_identification: parking_session.driver_identification,
        slot_number: parking_session.slot_number,
        checked_in_by: parking_session.checked_in_by,

        // The Timeline & Math
        check_in_time: check_in_time,
        flagged_at: exact_flagged_time,
        check_out_time: current_time,
        allowed_duration_minutes: allowed_duration_minutes,
        total_duration_minutes: parked_minutes,
        flagged_duration_minutes: flagged_duration,
      });

      await violation.save();
      console.log(
        `[SECURITY] Vehicle ${plate_number} automatically flagged at checkout for overstaying by ${flagged_duration} minutes.`,
      );

      // Populate the violation details for the frontend response
      violation_details = {
        allowed_minutes: allowed_duration_minutes,
        total_minutes: parked_minutes,
        overstayed_minutes: flagged_duration,
        Violation_details: null,
      };

      final_message = `Vehical checked out. WARNING: Vehicle overstayed by ${flagged_duration} minutes.`;
    }
    // ================================================================

    global.WebsocketIO?.emit("car_checkedout", {
      show_notif: is_flagged,
      type: is_flagged ? "warning" : "info",
      message: is_flagged
        ? `Vehicle ${plate_number} flagged for overstaying!`
        : `Vehicle ${plate_number} checked out.`,
    });

    // check car type and update the parking slot availability accordingly

    try {
      if (parking_session.driver_type.toLowerCase() === "visitor") {
        await ParkingSlot.findOneAndUpdate(
          { UnChangedId: "parking_slots" },
          { $inc: { visitorsAvailableSlots: 1 } },
        );
      } else if (parking_session.driver_type.toLowerCase() === "staff") {
        await ParkingSlot.findOneAndUpdate(
          { UnChangedId: "parking_slots" },
          { $inc: { staffAvailableSlots: 1 } },
        );
      } else if (parking_session.driver_type.toLowerCase() === "regular") {
        await ParkingSlot.findOneAndUpdate(
          { UnChangedId: "parking_slots" },
          { $inc: { RegularAvailableSlots: 1 } },
        );
      }
    } catch (error) {
      console.error(
        "Error updating parking slot availability during check-out:",
        error,
      );
    }

    return res.status(200).json({
      success: true,
      type: is_flagged ? "warning" : "success",
      message: final_message,
      data: {
        plate_number: plate_number,
        driver_type: parking_session.driver_type || "Not Specified",
        driver_name: parking_session.driver_name || "Not Specified",
        driver_telephone: parking_session.driver_telephone || "Not Specified",
        check_in_time: check_in_time,
        check_out_time: current_time,
        total_duration: `${parked_minutes} mins`,
        is_flagged: is_flagged,
        violation_details: violation_details,
      },
    });
  } catch (error) {
    console.error("Error in car_check_out:", error);
    return res
      .status(500)
      .json({
        success: false,
        type: "error",
        message: "Failed to check out car",
        error: error.message,
      });
  }
};
