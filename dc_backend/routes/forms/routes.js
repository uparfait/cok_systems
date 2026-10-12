const Router = require("express").Router();

const create_form = require("../../controllers/forms/create_form.js");
const update_form = require("../../controllers/forms/update_form.js");
const transfer_form_ownership = require("../../controllers/forms/transfer_form_ownership.js");
const get_forms_by_project = require("../../controllers/forms/get_forms_by_project.js");
const get_form_versions = require("../../controllers/forms/get_form_versions.js");
const get_form_by_id = require("../../controllers/forms/get_form_by_id.js");
const get_form_field_options = require("../../controllers/forms/get_form_field_options.js");
const set_active_version = require("../../controllers/forms/set_active_version.js");
const delete_form_version = require("../../controllers/forms/delete_form_version.js");
const upload_design_file = require("../../controllers/forms/upload_design_file.js");
const delete_design_file = require("../../controllers/forms/delete_design_file.js");
const search_forms = require("../../controllers/forms/search_forms.js");
const get_form_approvers = require("../../controllers/forms/get_form_approvers.js");
const get_form_submission_stats = require("../../controllers/forms/get_form_submission_stats.js");
const { get_table_settings, save_table_settings } = require("../../controllers/forms/table_settings.js");
const { list_translation_links, create_translation_link, delete_translation_link } = require("../../controllers/forms/translation_links.js");
const { list_translation_proposals, apply_translation_proposals, restore_translation_proposals, dismiss_translation_proposals } = require("../../controllers/forms/translation_proposals.js");
const { upload_design_file: upload_design_file_middleware } = require("../../utilities/upload.js");
const { import_template, import_upload_middleware, import_upload, import_run, import_status, import_cancel } = require("../../controllers/submissions/import_submissions.js");

/**
 * @swagger
 * /dcs/api/forms/upload:
 *   post:
 *     summary: Upload one content-block file (File/Image design component) while building a form
 *     tags: [Forms]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: File uploaded successfully
 */
Router.post("/upload", upload_design_file_middleware.single("file"), upload_design_file);

/**
 * @swagger
 * /dcs/api/forms/upload:
 *   delete:
 *     summary: Delete a content-block file no longer referenced by any component (replaced or removed)
 *     tags: [Forms]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: File deleted (or was already gone)
 */
Router.delete("/upload", delete_design_file);

/**
 * @swagger
 * /dcs/api/forms/project/{project_id}:
 *   get:
 *     summary: List the forms belonging to a project (latest version each)
 *     tags: [Forms]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Forms fetched successfully
 */
Router.get("/project/:project_id", get_forms_by_project);

/**
 * @swagger
 * /dcs/api/forms/project/{project_id}:
 *   post:
 *     summary: Create a new form (version 1) under a project
 *     tags: [Forms]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Form created successfully
 */
Router.post("/project/:project_id", create_form);

/**
 * @swagger
 * /dcs/api/forms/search:
 *   get:
 *     summary: Search form names across every project, access-filtered for the requesting user
 *     tags: [Forms]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Forms searched successfully
 */
Router.get("/search", search_forms);

/**
 * @swagger
 * /dcs/api/forms/{form_group_id}:
 *   get:
 *     summary: Get the currently active version of a form
 *     tags: [Forms]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Form fetched successfully
 */
Router.get("/:form_group_id", get_form_by_id);

/**
 * @swagger
 * /dcs/api/forms/{form_group_id}:
 *   put:
 *     summary: Publish a change as a brand new form version
 *     tags: [Forms]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: A new form version was created
 */
Router.put("/:form_group_id", update_form);

/**
 * @swagger
 * /dcs/api/forms/{form_group_id}/owner:
 *   put:
 *     summary: Transfer the form (all versions) to another employee - form owner or project owner only
 *     tags: [Forms]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Form ownership transferred successfully
 */
Router.put("/:form_group_id/owner", transfer_form_ownership);

/**
 * @swagger
 * /dcs/api/forms/{form_group_id}/approvers:
 *   get:
 *     summary: Paginated slice of the active version's approval-flow approvers (page/limit, default 20 per page, sliced inside MongoDB)
 *     tags: [Forms]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Approvers fetched successfully
 */
Router.get("/:form_group_id/approvers", get_form_approvers);

/**
 * @swagger
 * /dcs/api/forms/{form_group_id}/versions:
 *   get:
 *     summary: List every version of a form
 *     tags: [Forms]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Form versions fetched successfully
 */
Router.get("/:form_group_id/versions", get_form_versions);

/**
 * @swagger
 * /dcs/api/forms/{form_group_id}/field-options/{field_id}:
 *   get:
 *     summary: Resolve the real option content for one lazily-loaded select_group/cascading_select field (optionally filtered by a parent answer)
 *     tags: [Forms]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Form fetched successfully
 */
Router.get("/:form_group_id/field-options/:field_id", get_form_field_options);

/**
 * @swagger
 * /dcs/api/forms/{form_group_id}/stats:
 *   get:
 *     summary: Submissions time-series for a form, bucketed by a dynamic granularity based on the selected period
 *     tags: [Forms]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Form stats fetched successfully
 */
Router.get("/:form_group_id/stats", get_form_submission_stats);
// Which columns the form's data table hides, for everybody who opens it.
Router.get("/:form_group_id/table-settings", get_table_settings);
Router.put("/:form_group_id/table-settings", save_table_settings);

/**
 * @swagger
 * /dcs/api/forms/{form_group_id}/active-version:
 *   put:
 *     summary: Set which version is currently active
 *     tags: [Forms]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Active version updated successfully
 */
Router.put("/:form_group_id/active-version", set_active_version);

/**
 * @swagger
 * /dcs/api/forms/{form_group_id}/versions/{version}:
 *   delete:
 *     summary: Permanently delete one specific, non-active version of a form
 *     tags: [Forms]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Version deleted successfully
 */
Router.delete("/:form_group_id/versions/:version", delete_form_version);

/**
 * @swagger
 * /dcs/api/forms/{form_group_id}/translation-links:
 *   get:
 *     summary: List the form's translation links (form editors only)
 *     tags: [Forms]
 *   post:
 *     summary: Create a translation link - its holder may rewrite the form's texts in every language, except the locked kinds
 *     tags: [Forms]
 */
const { list_data_tokens, create_data_token, rotate_data_token, delete_data_token } = require("../../controllers/data_feed/data_tokens.js");

/**
 * @swagger
 * /dcs/api/forms/{form_group_id}/data-tokens:
 *   get:
 *     summary: The data-feed tokens of a form (editors only) - each one lets an external tool such as Power BI read the responses
 *     tags: [Forms]
 *     security:
 *       - BearerAuth: []
 *   post:
 *     summary: "Create a data-feed token (name, expires_in of never, 7d, 30d, 90d, 365d or an ISO date, scope of version, from, to)"
 *     tags: [Forms]
 * /dcs/api/forms/{form_group_id}/data-tokens/{token_id}:
 *   delete:
 *     summary: Revoke a data-feed token
 *     tags: [Forms]
 * /dcs/api/forms/{form_group_id}/data-tokens/{token_id}/rotate:
 *   post:
 *     summary: Give a data-feed token a new secret; URLs built on the old one stop working
 *     tags: [Forms]
 */
Router.get("/:form_group_id/data-tokens", list_data_tokens);
Router.post("/:form_group_id/data-tokens", create_data_token);
Router.delete("/:form_group_id/data-tokens/:token_id", delete_data_token);
Router.post("/:form_group_id/data-tokens/:token_id/rotate", rotate_data_token);

Router.get("/:form_group_id/translation-links", list_translation_links);
Router.post("/:form_group_id/translation-links", create_translation_link);
Router.delete("/:form_group_id/translation-links/:link_id", delete_translation_link);

/**
 * @swagger
 * /dcs/api/forms/{form_group_id}/translation-links/{link_id}/proposals:
 *   get:
 *     summary: What the link's translator proposed, each next to the text the form holds now (form editors only)
 *     tags: [Forms]
 * /dcs/api/forms/{form_group_id}/translation-links/{link_id}/proposals/apply:
 *   post:
 *     summary: Write the chosen pending proposals into the form (texts only, schema re-validated, replaced text remembered)
 *     tags: [Forms]
 * /dcs/api/forms/{form_group_id}/translation-links/{link_id}/proposals/restore:
 *   post:
 *     summary: Put the remembered text back for the chosen applied proposals
 *     tags: [Forms]
 * /dcs/api/forms/{form_group_id}/translation-links/{link_id}/proposals/dismiss:
 *   post:
 *     summary: Drop the chosen pending proposals without applying them
 *     tags: [Forms]
 */
Router.get("/:form_group_id/translation-links/:link_id/proposals", list_translation_proposals);
Router.post("/:form_group_id/translation-links/:link_id/proposals/apply", apply_translation_proposals);
Router.post("/:form_group_id/translation-links/:link_id/proposals/restore", restore_translation_proposals);
Router.post("/:form_group_id/translation-links/:link_id/proposals/dismiss", dismiss_translation_proposals);

/**
 * @swagger
 * /dcs/api/forms/{form_group_id}/import/template:
 *   get:
 *     summary: "Headers template of the form's fillable fields (a location field gives three columns - latitude, longitude, accuracy - the same the export writes); ?format=csv|xlsx (csv by default) - the xlsx adds an Options sheet listing each choice field's values (option labels, the country's locations for an API cascading field, 1..N, Yes/No) and a list validation on every single-choice column; ?language= picks the labels, English by default; form editors only"
 *     tags: [Forms]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: The template as a text/csv or .xlsx download
 * /dcs/api/forms/{form_group_id}/import/upload:
 *   post:
 *     summary: "Upload a .csv or .xlsx of responses (multipart field: file; an Excel file is read from its first sheet, row 1 the headers); the file is parsed and kept on the server; answers with the import id, the headers, a five-row preview and the form's fillable fields (id, label, type, required, options, location sub-targets)"
 *     tags: [Forms]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Import session opened
 *       413:
 *         description: The file is over the size cap (IMPORT_MAX_MB, 20 MB by default)
 *       422:
 *         description: Not an accepted format (IMPORT_FORMATS), unreadable workbook, no header row, a header appearing twice, no data rows, or more data rows than the cap (IMPORT_MAX_ROWS)
 * /dcs/api/forms/{form_group_id}/import/{import_id}/run:
 *   post:
 *     summary: "Start the import from { mapping: [{ column, field_id, part }] } (an optional defaults object is still accepted): every row is checked first with the public form's own validation and every problem collected as { row, column, field, reason }; anything found means nothing is written; a clean file is written in batches of 50 as submissions marked source=import, a failing batch removes what it wrote; answers at once with { running: true }"
 *     tags: [Forms]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       202:
 *         description: Import started
 *       409:
 *         description: This import already ran
 *       422:
 *         description: A required field would stay empty (required_fields lists them)
 * /dcs/api/forms/{form_group_id}/import/{import_id}/status:
 *   get:
 *     summary: "Progress of the import run: status (uploaded, running, done, failed, cancelled), stage, checked_rows and done_rows of total_rows, created, failed_rows, error, errors [{ row, column, field, reason }] (first 200) with error_count, notes [{ row, column, field, from, to }] (values matched to an option by other than their exact text, first 500) with note_count, and message"
 *     tags: [Forms]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Import progress fetched
 * /dcs/api/forms/{form_group_id}/import/{import_id}:
 *   delete:
 *     summary: "Give up an import that has not run: its uploaded file is removed and the session marked cancelled; 200 even when the file is already gone; 409 while it is running"
 *     tags: [Forms]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Import cancelled
 */
Router.get("/:form_group_id/import/template", import_template);
Router.post("/:form_group_id/import/upload", import_upload_middleware, import_upload);
Router.post("/:form_group_id/import/:import_id/run", import_run);
Router.get("/:form_group_id/import/:import_id/status", import_status);
Router.delete("/:form_group_id/import/:import_id", import_cancel);

module.exports = Router;
