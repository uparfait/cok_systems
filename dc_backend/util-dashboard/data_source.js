const { get_db } = require("../db_connection/db.js");
const forms_model = require("../models/forms_model.js");
const follow_up_forms_model = require("../models/follow_up_forms_model.js");
const dashboards_model = require("./dashboards_model.js");

/**
 * WHICH RECORDS a dashboard reads.
 *
 * A dashboard is created on the form's own data ("form") or on its
 * follow-up's data ("follow_up"). Both kinds of record look alike, so the
 * same pipelines serve both; what differs is the collection they run on
 * and the equality every pipeline opens with. That difference lives here
 * and nowhere else: the schema document a request resolves to (see
 * form_context.js) says which source it is, every widget is bound to that
 * source before its pipelines are built, and the pipelines ask this file
 * for their collection and their opening match.
 *
 * A follow-up's schema document carries follow_up_group_id; that is what
 * marks it as the follow-up source. It also wears the source form's
 * form_group_id, so widgets stay pinned to the form they belong to.
 */

const FORM_COLLECTION = "dcs_submissions";
const FOLLOW_UP_COLLECTION = "dcs_follow_up_submissions";
const SOURCES = ["form", "follow_up"];

/** "follow_up" for a follow-up schema document, "form" for a form version. */
function source_of(form_version) {
  return form_version && form_version.follow_up_group_id ? "follow_up" : "form";
}

/** { source, collection, match } for a schema document. */
function data_source_of(form_version) {
  if (source_of(form_version) === "follow_up") {
    return { source: "follow_up", collection: FOLLOW_UP_COLLECTION, match: { follow_up_group_id: form_version.follow_up_group_id } };
  }
  return { source: "form", collection: FORM_COLLECTION, match: { form_group_id: form_version.form_group_id } };
}

/** Binds a widget (or a probe) to the records its pipelines read. */
function bind_data_source(widget, form_version) {
  widget.data_source = data_source_of(form_version);
  return widget;
}

/** The equality every pipeline of a widget opens with; a widget never bound reads the form's own records. */
function source_match(widget) {
  if (widget && widget.data_source) return Object.assign({}, widget.data_source.match);
  return { form_group_id: widget.form_group_id };
}

/** The collection a widget's pipelines run on. */
function source_collection(widget) {
  return get_db().collection(widget && widget.data_source ? widget.data_source.collection : FORM_COLLECTION);
}

/** Every version of the schema document's own group: the follow-up's versions, or the form's. */
async function source_versions(form_version) {
  if (source_of(form_version) === "follow_up") return follow_up_forms_model.get_versions(form_version.follow_up_group_id);
  return forms_model.get_versions_by_group(form_version.form_group_id);
}

/** What a request says about its source: an explicit source, or the dashboard it is about. */
function wanted_source(req) {
  const body = (req && req.body) || {};
  const query = (req && req.query) || {};
  const pick = (value) => (typeof value === "string" && value.trim() ? value.trim() : "");
  return { source: pick(body.source) || pick(query.source), dashboard_id: pick(body.dashboard_id) || pick(query.dashboard_id) };
}

/**
 * The source a request is about: the one it names, else the source of
 * the dashboard it names, else the form's own records.
 */
async function resolve_dashboard_source(form_group_id, wanted) {
  if (!wanted) return "form";
  if (SOURCES.includes(wanted.source)) return wanted.source;
  if (wanted.dashboard_id) {
    const dashboard = await dashboards_model.get_dashboard_by_id(form_group_id, wanted.dashboard_id);
    return dashboard && dashboard.source === "follow_up" ? "follow_up" : "form";
  }
  return "form";
}

/**
 * The follow-up's active version (else its latest) as a schema document:
 * it wears the source form's form_group_id so every widget stays pinned
 * to the form, and its follow_up_group_id routes the pipelines. Null when
 * the form has no follow-up.
 */
async function follow_up_schema_version(form_group_id) {
  const latest = await follow_up_forms_model.get_by_group(form_group_id);
  if (!latest) return null;
  const version = (await follow_up_forms_model.get_active(latest.follow_up_group_id)) || latest;
  return Object.assign({}, version, { form_group_id, tracking: null });
}

module.exports = {
  FORM_COLLECTION,
  FOLLOW_UP_COLLECTION,
  SOURCES,
  source_of,
  data_source_of,
  bind_data_source,
  source_match,
  source_collection,
  source_versions,
  wanted_source,
  resolve_dashboard_source,
  follow_up_schema_version,
};
