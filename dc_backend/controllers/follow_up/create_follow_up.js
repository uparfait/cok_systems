const follow_up_forms_model = require("../../models/follow_up_forms_model.js");
const { editor_context, strip_follow_up } = require("./context.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const NAME_SUFFIX = " follow-up";

/**
 * Creates version 1 of a form's follow-up from the form's active version:
 * the same fields, the same respondent flag, named "<form name> follow-up".
 * A form holds one follow-up at most - a second request is refused.
 */
async function create_follow_up(req, res) {
  try {
    const context = await editor_context(req, res);
    if (!context) return undefined;
    if (context.follow_up_group_id) {
      return res.status(409).json(warning_response(req, "FOLLOW_UP_EXISTS"));
    }

    const source = context.source_version;
    const form_name = `${(source.form_name || "").toString().trim()}${NAME_SUFFIX}`.trim();
    const follow_up = await follow_up_forms_model.create_version_one(req.params.form_group_id, {
      project_id: String(source.project_id),
      form_name,
      form_name_normalized: form_name.toLowerCase(),
      schema: { fields: (source.schema && source.schema.fields) || [] },
      ask_respondent: source.ask_respondent !== false,
      created_by: req.user.user_id.toString(),
      created_by_name: req.user.full_name,
    });

    return res.status(201).json(success_response(req, "FOLLOW_UP_CREATED", strip_follow_up(follow_up)));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = create_follow_up;
