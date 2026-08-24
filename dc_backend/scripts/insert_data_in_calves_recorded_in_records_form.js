const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env"), quiet: true });
const connect_databases = require("../db_connection/main.js");
const { get_db } = require("../db_connection/db.js");
const forms_model = require("../models/forms_model.js");
const submissions_model = require("../models/submissions_model.js");
const { faker } = require("@faker-js/faker");

/**
 * Standalone bulk-seed script for one specific form: "Calves recorded"
 * (project 6a8a8e553712274a2d5b0f3b, form_group_id
 * a0cc1789-682b-48f2-bfd6-fb614563f11f - see its schema fields:
 * date_recorded, date_birth, text_farmer_name, text_calf_breed,
 * text_mother_id). Every run first deletes every existing submission for
 * this form, then regenerates data for every hour from 9:00 to 17:00
 * (9am-5pm) for every calendar day between FROM_DATE and TO_DATE below -
 * each hour gets its own random count of records between
 * MIN_RECORDS_PER_HOUR and MAX_RECORDS_PER_HOUR, so the total is only
 * known once the run finishes (logged at the end), never predictable in
 * advance the way a fixed one-per-hour count would be.
 *
 * Usage: node scripts/insert_data_in_calves_recorded_in_records_form.js
 *
 * Change FROM_DATE/TO_DATE to control the range, and
 * MIN_RECORDS_PER_HOUR/MAX_RECORDS_PER_HOUR to control how much data each
 * hour gets - the defaults span 26 years, so left as-is this can produce a
 * very large number of documents.
 */
let FROM_DATE = "2025-12-30";
let TO_DATE = "2026-12-23";

const PROJECT_ID = "6a8beef09370789817de85cc";
const FORM_GROUP_ID = "37be60dd-4b44-41bb-b601-01084524abc8";

const START_HOUR = 9;
const END_HOUR = 17;

const MIN_RECORDS_PER_HOUR = 0;
const MAX_RECORDS_PER_HOUR = 50;

function format_date_only(date) {
  return date.toISOString().slice(0, 10);
}

// Every record generated for the same hour would otherwise share the exact
// same HH:00:00 timestamp - scattering minutes/seconds within the hour
// keeps them distinct and reads as real, independently-submitted entries.
function random_time_within_hour(base_hour_datetime) {
  const result = new Date(base_hour_datetime);
  result.setUTCMinutes(faker.number.int({ min: 0, max: 59 }), faker.number.int({ min: 0, max: 59 }));
  return result;
}

function random_mother_id() {
  return `COW-${faker.string.alphanumeric({ length: 6, casing: "upper" })}`;
}

// A calf is born some time before its record is entered, never after -
// the form's own validation caps date_birth at a fixed date, so staying
// safely in the past of date_recorded (up to ~13 months back) keeps every
// generated value plausible without needing to run the JSONLogic validator
// itself for what is just synthetic data generation.
function random_date_birth_before(record_date) {
  const offset_days = faker.number.int({ min: 0, max: 400 });
  return new Date(record_date.getTime() - offset_days * 24 * 60 * 60 * 1000);
}

function build_submission_document(record_datetime, version) {
  return {
    form_group_id: FORM_GROUP_ID,
    version,
    project_id: PROJECT_ID,
    data: {
      date_recorded: format_date_only(record_datetime),
      date_birth: format_date_only(random_date_birth_before(record_datetime)),
      text_farmer_name: `${faker.person.firstName()} ${faker.person.lastName()}`,
      text_calf_breed: faker.animal.cow(),
      text_mother_id: random_mother_id(),
    },
    client_submission_id: null,
    // create_submission() always stamps "now" - inserted directly here
    // instead, since the brief is for submitted_at to read as the exact
    // looping date/hour being generated, not the real clock.
    submitted_at: record_datetime,
  };
}

async function run() {
  const connection_result = await connect_databases();
  if (!connection_result.status) {
    console.error("Could not connect to the database:", connection_result.error);
    process.exit(1);
  }

  const active_version = await forms_model.get_active_version(FORM_GROUP_ID);
  if (!active_version) {
    console.error(`No active version found for form_group_id ${FORM_GROUP_ID}`);
    process.exit(1);
  }

  const deleted_count = await submissions_model.delete_by_form_group_ids([FORM_GROUP_ID]);
  console.log(`Deleted ${deleted_count} existing submission(s) for this form.`);

  const from_date = new Date(`${FROM_DATE}T00:00:00.000Z`);
  const to_date = new Date(`${TO_DATE}T00:00:00.000Z`);
  if (Number.isNaN(from_date.getTime()) || Number.isNaN(to_date.getTime()) || from_date > to_date) {
    console.error("FROM_DATE/TO_DATE must be valid ISO dates (YYYY-MM-DD) with FROM_DATE on or before TO_DATE.");
    process.exit(1);
  }

  const submissions_collection = get_db().collection("dcs_submissions");
  const BATCH_SIZE = 500;
  let pending_documents = [];
  let total_created = 0;

  const current_day = new Date(from_date);
  while (current_day <= to_date) {
    for (let hour = START_HOUR; hour <= END_HOUR; hour += 1) {
      const hour_start = new Date(
        Date.UTC(current_day.getUTCFullYear(), current_day.getUTCMonth(), current_day.getUTCDate(), hour, 0, 0),
      );
      const records_this_hour = faker.number.int({ min: MIN_RECORDS_PER_HOUR, max: MAX_RECORDS_PER_HOUR });

      for (let record_index = 0; record_index < records_this_hour; record_index += 1) {
        const record_datetime = random_time_within_hour(hour_start);
        pending_documents.push(build_submission_document(record_datetime, active_version.version));

        if (pending_documents.length >= BATCH_SIZE) {
          await submissions_collection.insertMany(pending_documents);
          total_created += pending_documents.length;
          pending_documents = [];
        }
      }
    }
    current_day.setUTCDate(current_day.getUTCDate() + 1);
  }

  if (pending_documents.length > 0) {
    await submissions_collection.insertMany(pending_documents);
    total_created += pending_documents.length;
  }

  console.log(`Total records created: ${total_created}`);
  process.exit(0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
