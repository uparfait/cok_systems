const approval_schedules_model = require("../models/approval_schedules_model.js");
const { fire_claimed_schedule } = require("./batch_approval.js");

const CHECK_INTERVAL_MS = 60 * 1000;

/** One scan: fires every "at this date and time" schedule whose moment has arrived. */
async function run_due_schedules() {
  try {
    const due = await approval_schedules_model.find_due_datetime_schedules(new Date());
    for (const schedule of due) {
      const claimed = await approval_schedules_model.claim_schedule_for_sending(schedule._id);
      if (claimed) await fire_claimed_schedule(schedule, null);
    }
  } catch (error) {
    console.error("Batch approval schedule scan failed:", error.message);
  }
}

/**
 * Starts the once-a-minute background check that fires date/time-triggered
 * approval schedules. unref() keeps this timer from ever holding the
 * process open on its own.
 */
function start_approval_schedule_runner() {
  run_due_schedules();
  const interval = setInterval(run_due_schedules, CHECK_INTERVAL_MS);
  if (interval.unref) interval.unref();
}

module.exports = { start_approval_schedule_runner };
