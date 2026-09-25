/**
 * Builds the seven disaster boards of `dmis_dash.html` as paste-ready
 * dashboard JSON for the DMIS form. Run it again after changing anything
 * here (node build_boards.js) - the JSON files beside it are its output
 * and should not be edited by hand.
 *
 * Every board is a dark PANEL (a canvas) holding, in the HTML's order: a
 * title band (a text block), a row of one card per district plus a total,
 * then the tables, stacked bars, trend lines and observation texts the
 * HTML draws. Colours and labels are the HTML's own.
 */
const fs = require("fs");
const path = require("path");

const FORM = "ef2401f3-f5ab-4e0e-a02a-ec28e2e76ebd";

// The DMIS form's fields (see README.md for the full mapping).
const F = {
  DISTRICT: "cascading_select_8dz9o8",
  SECTOR: "cascading_select_v0mxca",
  PURPOSE: "single_select_4d066b",
  INCIDENT_TIME: "date_time_07fa41",
  HOT_CAT: "single_select_101af2",
  HOT_TYPE: "cascading_select_b49b76",
  EXPOSED: "number_b20f56",
  RISK: "single_select_f42575",
  FAC_TYPE: "cascading_select_3ec652",
  FAC_STATUS: "single_select_7b7b58",
  HH_NAME: "text_d8f416",
  DEATHS: "number_ca002e",
  INJURED: "number_271ca1",
  TRAUMA: "number_9a0824",
  MISSING: "number_07a4a8",
  DRIVER: "single_select_7c5216",
  HOUSE_DAMAGED: "single_select_998282",
  HOUSE_HOW: "single_select_8c0eb4",
  STRUCTURES: "multi_select_b293aa",
};

const DISTRICTS = ["Gasabo", "Kicukiro", "Nyarugenge"];

// The form's own option labels, so a table column or a bar reads "Riverine
// flood" rather than "riverine_flood" - looked up from the form JSON.
const FORM_SCHEMA = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "DMIS_Assessment_Form.json"), "utf8"));
function option_labels(field_id) {
  const flat = [];
  const walk = (fields) => (fields || []).forEach((field) => { flat.push(field); walk(field.children); });
  walk(FORM_SCHEMA.fields);
  const field = flat.find((entry) => entry && entry.id === field_id);
  const labels = {};
  ((field && field.options) || []).forEach((option) => {
    const label = option && option.label && (option.label.en || option.label.kn || option.label.fr);
    if (option && option.value !== undefined && label) labels[option.value] = String(label);
  });
  return labels;
}

// The HTML's palette.
const C = {
  panel_bg: "#14318f",
  panel_border: "#0d2472",
  box_bg: "#173a9c",
  white: "#ffffff",
  title_bg: "#0d2472",
  accent: "#39d7ff",
  board_bg: "#e9eef7",
};
const HAZARD_COLORS = { fire: "#e8542a", heavy_rain: "#1f5fc4", rain_wind: "#15b3e0", wind: "#8a3fb0", lightning: "#7fb2ff" };
const HAZARD_LABELS = { fire: "Fire", heavy_rain: "Rain", rain_wind: "Rain&Wind", wind: "Wind", lightning: "Inkuba" };
const RISK_COLORS = { high: "#e0393e", moderate: "#e8951e", low: "#1a9ad6", no_risk: "#1fae6b" };
const RISK_LABELS = { high: "High", moderate: "Moderate", low: "Low", no_risk: "No risk" };
const FAC_TYPE_LABELS = option_labels("cascading_select_3ec652");
const HOT_TYPE_LABELS = option_labels("cascading_select_b49b76");
const HOUSE_LABELS = { roof_blown_off_d: "Roof", walls_damaged: "Wall", lightly_damaged: "Slightly", flooded_water_entered: "Flooded", completely_destroyed: "Completely", high_risk_zone: "HRZ", no_problem: "No problem" };

const eq = (field_id, value) => ({ field_id, operator: "eq", value });
const purpose = (value) => eq(F.PURPOSE, value);

const box_look = (extra) => Object.assign({ theme: "light", light: { background: C.box_bg, text: C.white, number: C.white, border: C.white }, border_width: 2 }, extra || {});

/** Every key a widget document carries, so the validator sees a complete widget. */
function widget(id, chart_type, extra) {
  return Object.assign(
    {
      id,
      form_group_id: FORM,
      title: "",
      description: null,
      icon: null,
      chart_type,
      metric: { aggregation: "count", field_id: null },
      group_by: null,
      split_by: null,
      pattern_by: null,
      legend_by: null,
      appearance: null,
      x_field_id: null,
      y_field_id: null,
      size_field_id: null,
      filters: [],
      period: { preset: "all", from: null, to: null },
      sort: "value_desc",
      limit: 12,
      size: "large",
      position: 0,
      parent_id: null,
      box: null,
      pinned_fields: [],
    },
    extra,
  );
}

const ROW = (percent, min_px) => ({ flow: "row", width: { value: percent, unit: "%" }, min_width: { value: min_px || 150, unit: "px" } });
const COLUMN = { flow: "column" };

/** The dark panel every page of the HTML is drawn on. */
const panel = (id) =>
  widget(id, "canvas", {
    appearance: { theme: "light", light: { background: C.panel_bg, text: C.white, number: C.white, border: C.panel_border }, border_width: 2 },
    canvas: { flow: "row", gap: 10, size_mode: "fixed", width: null, height: null, min_width: null, max_width: null, min_height: null, max_height: null },
  });

/** The HTML's title band: a text block, heading only, centred on the darker blue. */
const banner = (id, parent_id, heading) =>
  widget(id, "text", {
    parent_id,
    box: COLUMN,
    text: { heading, body: "", align: "center", size: "lg" },
    appearance: { theme: "light", light: { background: C.title_bg, text: C.white, number: C.white, border: C.white }, border_width: 0 },
  });

/**
 * An observation block: the HTML's `text()` box. Its figures are LIVE -
 * {{count(...)}}, {{sum(...)}}, {{share(...)}} computed under the board's
 * filters and date - so it carries the module its figures count within
 * (filters) like every other widget of its panel.
 */
const note = (id, parent_id, heading, body, box, filters, extra) =>
  widget(id, "text", {
    parent_id,
    box: box || COLUMN,
    filters: filters || [],
    text: { heading: heading || "", body, align: "left", size: "md", accent: C.accent },
    appearance: box_look(),
    ...(extra || {}),
  });

/** One district card (the HTML's `card(name, value)`), pinned so a district filter never hides its neighbours. */
const district_card = (id, parent_id, district, filters) =>
  widget(id, "kpi", {
    parent_id,
    box: ROW(24, 130),
    title: district,
    size: "small",
    filters: [eq(F.DISTRICT, district)].concat(filters),
    appearance: box_look(),
    pinned_fields: [F.DISTRICT],
  });

/** The HTML's `total(v)` box. */
const total_card = (id, parent_id, filters) =>
  widget(id, "kpi", { parent_id, box: ROW(24, 130), title: "TOT", size: "small", filters, appearance: box_look(), pinned_fields: [F.DISTRICT] });

/** The HTML's `dist(a, b, c, t)` row. */
const district_row = (prefix, parent_id, filters, with_total) => DISTRICTS.map((district, index) => district_card(`${prefix}_${index + 1}`, parent_id, district, filters)).concat(with_total === false ? [] : [total_card(`${prefix}_tot`, parent_id, filters)]);

/** A summary table with measure columns: the HTML's `table(head, rows)` with a Total row. */
const measure_table = (id, parent_id, title, group_field, columns, filters, extra) =>
  widget(id, "table", {
    parent_id,
    box: COLUMN,
    title,
    group_by: { field_id: group_field },
    filters,
    sort: "label_asc",
    limit: 50,
    table: { mode: "summary", columns, totals: { row: true, column: false } },
    appearance: box_look({ compact: false }),
    pinned_fields: group_field === F.DISTRICT ? [F.DISTRICT] : [],
    ...(extra || {}),
  });

const sum_of = (key, label, field_id) => ({ key, label, aggregation: "sum", field_id, filters: [] });
const count_where = (key, label, filters) => ({ key, label, aggregation: "count", field_id: null, filters });

/** The HTML's stacked horizontal bars, coloured by hazard or by risk. */
const stacked = (id, parent_id, title, group_field, split_field, filters, colors, labels, box, extra) =>
  widget(id, "stacked_bar", {
    parent_id,
    box: box || COLUMN,
    title,
    group_by: { field_id: group_field },
    split_by: { field_id: split_field },
    filters,
    limit: 20,
    appearance: box_look({ value_colors: colors, value_labels: labels, legend_position: "bottom" }),
    ...(extra || {}),
  });

/** The HTML's `line(peaks)`: records per month of the incidence date. */
const trend = (id, parent_id, title, filters) =>
  widget(id, "line", {
    parent_id,
    box: COLUMN,
    title,
    group_by: { field_id: F.INCIDENT_TIME, granularity: "month" },
    filters,
    appearance: box_look({ light: { background: C.box_bg, text: C.white, number: C.accent, border: C.white } }),
  });

const hazard_colors = Object.assign({}, HAZARD_COLORS);
const hazard_labels = Object.assign({}, HAZARD_LABELS);

const HOUSEHOLD = [purpose("household_loss")];
const INFRA = [purpose("infrastructure")];
const HOTSPOT = [purpose("hotspot")];
const COMMON_FILTERS = [{ field_id: F.DISTRICT }, { field_id: F.SECTOR }, { field_id: F.DRIVER }];

const boards = [];

// 1. Disaster impact on HH by district
{
  const p1 = "d1_hh_panel";
  const p2 = "d1_fac_panel";
  boards.push({
    file: "01-impact-on-households-by-district.json",
    name: "Disaster impact on HH by district",
    filters: COMMON_FILTERS,
    widgets: [
      panel(p1),
      banner("d1_hh_title", p1, "DISASTER IMPACT ON HH BY DISTRICT"),
      ...district_row("d1_hh", p1, HOUSEHOLD),
      measure_table(
        "d1_hh_table",
        p1,
        "Households affected, casualties and damaged structures per district",
        F.DISTRICT,
        [
          sum_of("deaths", "Deaths", F.DEATHS),
          sum_of("injured", "Injured", F.INJURED),
          count_where("hh", "HH Name", [{ field_id: F.HH_NAME, operator: "not_empty", value: "" }]),
          count_where("annex", "Annex", [eq(F.STRUCTURES, "annex_extension")]),
          count_where("kitchen", "Kitchen", [eq(F.STRUCTURES, "kitchen_struct")]),
          count_where("fences", "Fences", [eq(F.STRUCTURES, "fence_enclosure")]),
          count_where("wall", "Retaining wall", [eq(F.STRUCTURES, "retaining_wall_struct")]),
          count_where("houses", "All houses", [eq(F.HOUSE_DAMAGED, "yes")]),
        ],
        HOUSEHOLD,
      ),
      panel(p2),
      banner("d1_fac_title", p2, "DISASTER IMPACTS ON FACILITY BY DISTRICT"),
      ...district_row("d1_fac", p2, INFRA),
      widget("d1_fac_table", "table", {
        parent_id: p2,
        box: COLUMN,
        title: "Facilities affected per district and type of facility",
        group_by: { field_id: F.DISTRICT },
        split_by: { field_id: F.FAC_TYPE },
        filters: INFRA,
        sort: "label_asc",
        limit: 50,
        table: { mode: "summary", columns: [], totals: { row: true, column: true } },
        appearance: box_look({ compact: false, value_labels: FAC_TYPE_LABELS }),
        pinned_fields: [F.DISTRICT],
      }),
    ],
  });
}

// 2. Spatial distribution - disaster impact on housing
{
  const p = "d2_panel";
  const damaged = HOUSEHOLD.concat([eq(F.HOUSE_DAMAGED, "yes")]);
  boards.push({
    file: "02-spatial-distribution-housing.json",
    name: "Spatial distribution - disaster impact on housing",
    filters: COMMON_FILTERS,
    widgets: [
      panel(p),
      banner("d2_title", p, "SPATIAL DISTRIBUTION OF DISASTER IMPACT ON HOUSING IN THE CITY OF KIGALI"),
      ...district_row("d2", p, damaged),
      stacked("d2_damage", p, "How houses were damaged, by hazard", F.HOUSE_HOW, F.DRIVER, damaged, hazard_colors, Object.assign({}, hazard_labels, HOUSE_LABELS)),
      trend("d2_trend", p, "Damaged houses per month of incidence", damaged),
    ],
  });
}

// 3. Spatial distribution - hazard and health impacts
{
  const p = "d3_panel";
  boards.push({
    file: "03-spatial-distribution-hazard-health.json",
    name: "Spatial distribution - hazard and health impacts",
    filters: COMMON_FILTERS,
    widgets: [
      panel(p),
      banner("d3_title", p, "SPATIAL DISTRIBUTION OF HAZARD IMPACTS AND HEALTH IMPACTS IN KIGALI"),
      // The HTML names the districts here without a total: no TOT card.
      ...district_row("d3", p, HOUSEHOLD, false),
      widget("d3_mosaic", "treemap", {
        parent_id: p,
        box: ROW(60, 260),
        title: "Deaths by hazard",
        metric: { aggregation: "sum", field_id: F.DEATHS },
        group_by: { field_id: F.DRIVER },
        filters: HOUSEHOLD,
        limit: 12,
        appearance: box_look({ value_colors: hazard_colors, value_labels: hazard_labels }),
      }),
      note(
        "d3_note",
        p,
        "HEALTH IMPACTS VS HAZARDS",
        "Rain and wind events (=={{sum(number_271ca1 | single_select_7c5216 = rain_wind)}} injuries==) are the main drivers of injuries.\n\nRain events (=={{sum(number_271ca1 | single_select_7c5216 = heavy_rain)}} injuries, {{sum(number_07a4a8 | single_select_7c5216 = heavy_rain)}} missing==) present both safety and search-and-rescue challenges.\n\nFire incidents (=={{sum(number_ca002e | single_select_7c5216 = fire)}} deaths==) pose the highest fatality risk and remain a critical life-safety concern.",
        ROW(38, 240),
        HOUSEHOLD,
      ),
      measure_table(
        "d3_table",
        p,
        "Casualties per hazard",
        F.DRIVER,
        [sum_of("deaths", "Deaths", F.DEATHS), sum_of("injured", "Injured", F.INJURED), sum_of("trauma", "Trauma", F.TRAUMA), sum_of("missing", "Missing", F.MISSING)],
        HOUSEHOLD,
        { appearance: box_look({ compact: false, value_labels: hazard_labels }) },
      ),
    ],
  });
}

// 4. Spatial distribution - facility impacts
{
  const p = "d4_panel";
  boards.push({
    file: "04-spatial-distribution-facilities.json",
    name: "Spatial distribution - facility impacts",
    filters: COMMON_FILTERS,
    widgets: [
      panel(p),
      banner("d4_title", p, "SPATIAL DISTRIBUTION OF DISASTER IMPACTS ON FACILITY IN THE CITY OF KIGALI"),
      ...district_row("d4", p, INFRA),
      stacked("d4_facilities", p, "Facilities affected, by type and hazard", F.FAC_TYPE, F.DRIVER, INFRA, hazard_colors, Object.assign({}, hazard_labels, FAC_TYPE_LABELS), ROW(60, 260)),
      note(
        "d4_note",
        p,
        "Facilities vs. Hazards",
        "Rain combined with wind hit =={{count(single_select_7c5216 = rain_wind)}} of {{count}} facilities ({{share(single_select_7c5216 = rain_wind)}})== and heavy rain another =={{count(single_select_7c5216 = heavy_rain)}} ({{share(single_select_7c5216 = heavy_rain)}})== - the two most destructive hazards by far.\n\nFire caused =={{count(single_select_7c5216 = fire)}} hits== ({{share(single_select_7c5216 = fire)}}), mostly on community buildings, schools and agricultural facilities.\n\nWind alone accounts for =={{count(single_select_7c5216 = wind)}} facilities== - the lowest hazard threat across all asset types.",
        ROW(38, 240),
        INFRA,
      ),
    ],
  });
}

// 5. Spatial distribution - districts vs hazards
{
  const p = "d5_panel";
  boards.push({
    file: "05-spatial-distribution-districts-vs-hazards.json",
    name: "Spatial distribution - districts vs hazards",
    filters: COMMON_FILTERS,
    widgets: [
      panel(p),
      banner("d5_title", p, "SPATIAL DISTRIBUTION OF HAZARD IMPACTS AND HEALTH IMPACTS"),
      ...district_row("d5", p, HOUSEHOLD),
      stacked("d5_districts", p, "Households affected per district, by hazard", F.DISTRICT, F.DRIVER, HOUSEHOLD, hazard_colors, hazard_labels, ROW(60, 260), { pinned_fields: [F.DISTRICT] }),
      note(
        "d5_note",
        p,
        "DISTRICTS vs HAZARDS",
        "Gasabo (=={{count(cascading_select_8dz9o8 = Gasabo)}} | {{share(cascading_select_8dz9o8 = Gasabo)}}==) carries the largest share of the households affected, with impacts driven by rain (=={{count(single_select_7c5216 = heavy_rain | cascading_select_8dz9o8 = Gasabo)}}==), rain & wind (=={{count(single_select_7c5216 = rain_wind | cascading_select_8dz9o8 = Gasabo)}}==) and fire (=={{count(single_select_7c5216 = fire | cascading_select_8dz9o8 = Gasabo)}}==).\n\nNyarugenge (=={{count(cascading_select_8dz9o8 = Nyarugenge)}} | {{share(cascading_select_8dz9o8 = Nyarugenge)}}==) faces significant urban risk, with impacts driven by rain (=={{count(single_select_7c5216 = heavy_rain | cascading_select_8dz9o8 = Nyarugenge)}}==), rain & wind (=={{count(single_select_7c5216 = rain_wind | cascading_select_8dz9o8 = Nyarugenge)}}==) and fire (=={{count(single_select_7c5216 = fire | cascading_select_8dz9o8 = Nyarugenge)}}==).\n\nKicukiro (=={{count(cascading_select_8dz9o8 = Kicukiro)}} | {{share(cascading_select_8dz9o8 = Kicukiro)}}==) records the remaining impacts, with impacts driven by rain (=={{count(single_select_7c5216 = heavy_rain | cascading_select_8dz9o8 = Kicukiro)}}==), rain & wind (=={{count(single_select_7c5216 = rain_wind | cascading_select_8dz9o8 = Kicukiro)}}==) and fire (=={{count(single_select_7c5216 = fire | cascading_select_8dz9o8 = Kicukiro)}}==).",
        ROW(38, 240),
        HOUSEHOLD,
        { pinned_fields: [F.DISTRICT] },
      ),
      trend("d5_trend", p, "Households affected per month of incidence", HOUSEHOLD),
    ],
  });
}

// 6. Hotspot identification and monitoring - summary
{
  const p = "d6_panel";
  const tile = (id, value) =>
    widget(id, "kpi", {
      parent_id: p,
      box: ROW(24, 130),
      title: RISK_LABELS[value],
      size: "small",
      filters: HOTSPOT.concat([eq(F.RISK, value)]),
      appearance: { theme: "light", light: { background: RISK_COLORS[value], text: C.white, number: C.white, border: RISK_COLORS[value] }, border_width: 0 },
      pinned_fields: [F.RISK],
    });
  boards.push({
    file: "06-hotspot-monitoring-summary.json",
    name: "Hotspot identification and monitoring - summary",
    filters: COMMON_FILTERS.concat([{ field_id: F.RISK }]),
    widgets: [
      panel(p),
      banner("d6_title", p, "REPORT ON HOTSPOT IDENTIFICATION AND MONITORING"),
      ...district_row("d6", p, HOTSPOT),
      // The HTML's two-by-two grid of tiles beside the note: a section of
      // its own for the tiles, each half of it.
      Object.assign(panel("d6_tiles"), { parent_id: p, box: ROW(60, 260), appearance: { theme: "light", light: { background: C.panel_bg, text: C.white, number: C.white, border: C.panel_bg }, border_width: 0 } }),
      Object.assign(tile("d6_high", "high"), { parent_id: "d6_tiles", box: ROW(48, 130) }),
      Object.assign(tile("d6_moderate", "moderate"), { parent_id: "d6_tiles", box: ROW(48, 130) }),
      Object.assign(tile("d6_low", "low"), { parent_id: "d6_tiles", box: ROW(48, 130) }),
      Object.assign(tile("d6_none", "no_risk"), { parent_id: "d6_tiles", box: ROW(48, 130) }),
      note(
        "d6_note",
        p,
        "",
        "**OBSERVATIONS**\nHigh-risk hotspots (=={{share(single_select_f42575 = high)}}==, {{count(single_select_f42575 = high)}} of {{count}}) indicate severe and escalating vulnerability across the City of Kigali, requiring urgent and coordinated action. Kicukiro District has logged =={{count(cascading_select_8dz9o8 = Kicukiro)}} hotspots==, Gasabo {{count(cascading_select_8dz9o8 = Gasabo)}} and Nyarugenge {{count(cascading_select_8dz9o8 = Nyarugenge)}} - the district leading in identification and monitoring reflects an operational efficiency to be replicated, while confirming uneven but widespread risk exposure.\n\n**RECOMMENDATION**\nPrioritize immediate intervention in the =={{count(single_select_f42575 = high)}} high-risk hotspots== through drainage improvement, slope stabilization, relocation, and strict enforcement of land-use regulations.",
        ROW(38, 240),
        HOTSPOT,
        { pinned_fields: [F.DISTRICT, F.RISK] },
      ),
    ],
  });
}

// 7. Hotspot identification and monitoring - assets
{
  const p = "d7_panel";
  boards.push({
    file: "07-hotspot-monitoring-assets.json",
    name: "Hotspot identification and monitoring - assets",
    filters: COMMON_FILTERS.concat([{ field_id: F.RISK }]),
    widgets: [
      panel(p),
      banner("d7_title", p, "REPORT ON HOTSPOT IDENTIFICATION AND MONITORING"),
      ...district_row("d7", p, HOTSPOT),
      stacked("d7_assets", p, "Hotspots by type of asset and risk status", F.HOT_TYPE, F.RISK, HOTSPOT, RISK_COLORS, Object.assign({}, RISK_LABELS, HOT_TYPE_LABELS), ROW(60, 260), { sort: "value_desc", limit: 20 }),
      note(
        "d7_note",
        p,
        "Dominant High-Risk Assets",
        "Ravines lead with =={{count(single_select_f42575 = high | cascading_select_b49b76 = ravines)}} High-risk sites out of {{count(cascading_select_b49b76 = ravines)}}== - the most critical asset in Kigali. Retaining walls at risk (=={{count(single_select_f42575 = high | cascading_select_b49b76 = retaining_walls_at_risk)}} High-risk sites out of {{count(cascading_select_b49b76 = retaining_walls_at_risk)}}==) and old, poorly-built housing (=={{count(single_select_f42575 = high | cascading_select_b49b76 = old_poorly_built_housing)}} High-risk sites out of {{count(cascading_select_b49b76 = old_poorly_built_housing)}}==) confirm landslide and housing risk are top priorities. Out of {{count}} hotspots, only {{count(single_select_f42575 = no_risk)}} are rated No Risk.\n\n**Moderate Risk: the Next Wave**\nSteep or fragile slopes hold =={{count(single_select_f42575 = moderate | cascading_select_b49b76 = steep_fragile_slope)}} Moderate sites== of {{count(cascading_select_b49b76 = steep_fragile_slope)}}, all trending toward High. In all, =={{count(single_select_f42575 = moderate)}} hotspots== are the next High-risk wave if unmitigated.",
        ROW(38, 240),
        HOTSPOT,
        { pinned_fields: [F.RISK] },
      ),
      trend("d7_trend", p, "Hotspots logged per month of incidence", HOTSPOT),
    ],
  });
}

// Write the files: positions in array order, one document per board.
const written = boards.map((board) => {
  const widgets = board.widgets.map((entry, index) => Object.assign(entry, { position: index }));
  const document = { name: board.name, filters: board.filters, widgets };
  fs.writeFileSync(path.join(__dirname, board.file), JSON.stringify(document, null, 2) + "\n");
  return { file: board.file, widgets: widgets.length };
});
written.forEach((entry) => console.log(`${entry.file}: ${entry.widgets} widgets`));
console.log(`${written.length} boards written`);
