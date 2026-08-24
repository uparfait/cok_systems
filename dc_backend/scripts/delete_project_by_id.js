const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env"), quiet: true });
const connect_databases = require("../db_connection/main.js");
const projects_model = require("../models/projects_model.js");
const forms_model = require("../models/forms_model.js");
const submissions_model = require("../models/submissions_model.js");

/**
 * Standalone CLI utility to permanently delete a project, every one of its
 * forms and every submission collected under it, without going through the
 * API. Usage: node scripts/delete_project_by_id.js <project_id>
 */
async function run() {
  const project_id = process.argv[2];
  if (!project_id) {
    console.error("Usage: node scripts/delete_project_by_id.js <project_id>");
    process.exit(1);
  }

  const connection_result = await connect_databases();
  if (!connection_result.status) {
    console.error("Could not connect to the database:", connection_result.error);
    process.exit(1);
  }

  const project = await projects_model.find_project_by_id(project_id);
  if (!project) {
    console.error("No project found with id", project_id);
    process.exit(1);
  }

  const form_group_ids = await forms_model.get_form_group_ids_by_project(project_id);
  const deleted_submissions = await submissions_model.delete_by_form_group_ids(form_group_ids);
  const deleted_forms = await forms_model.delete_forms_by_project(project_id);
  await projects_model.delete_project(project_id);

  console.log(`Deleted project "${project.name}" (${project_id})`);
  console.log(`Deleted ${deleted_forms} form version document(s) across ${form_group_ids.length} form(s)`);
  console.log(`Deleted ${deleted_submissions} submission(s)`);
  process.exit(0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
