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
const { list_translation_links, create_translation_link, delete_translation_link } = require("../../controllers/forms/translation_links.js");
const { list_translation_proposals, apply_translation_proposals, restore_translation_proposals, dismiss_translation_proposals } = require("../../controllers/forms/translation_proposals.js");
const { upload_design_file: upload_design_file_middleware } = require("../../utilities/upload.js");

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

module.exports = Router;
