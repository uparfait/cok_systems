/**
 * Builds the seven disaster boards of `dmis_dash.html` as paste-ready
 * dashboard JSON for the DMIS form. Run it again after changing anything
 * here (node build_boards.js) - the JSON files beside it are its output
 * and should not be edited by hand.
 *
 * Every board is PLAIN WIDGETS on the ordinary grid - no canvases, no
 * boxes, and the usual white cards: the board's own KPI row carries the
 * district cards and the risk tiles, then the title bands, tables, bars,
 * trend lines and notes follow in the HTML's order. The HTML's hazard and
 * risk colours survive only where they carry meaning - as series colours
 * on the bars and as the number colour of a tile - and its labels are kept.
 * Every figure in a note is LIVE ({{count(...)}}, {{sum(...)}},
 * {{share(...)}}), computed under the board's filters and date.
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
  HOT_TYPE: "cascading_select_b49b76",
  RISK: "single_select_f42575",
  FAC_TYPE: "cascading_select_3ec652",
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
  const walk = (fields) =>
    (fields || []).forEach((field) => {
      flat.push(field);
      walk(field.children);
    });
  walk(FORM_SCHEMA.fields);
  const field = flat.find((entry) => entry && entry.id === field_id);
  const labels = {};
  ((field && field.options) || []).forEach((option) => {
    const label = option && option.label && (option.label.en || option.label.kn || option.label.fr);
    if (option && option.value !== undefined && label) labels[option.value] = String(label);
  });
  return labels;
}

// The HTML's hazard and risk colours, kept where they carry meaning.
const HAZARD_COLORS = { fire: "#e8542a", heavy_rain: "#1f5fc4", rain_wind: "#15b3e0", wind: "#8a3fb0", lightning: "#7fb2ff" };
const HAZARD_LABELS = { fire: "Fire", heavy_rain: "Rain", rain_wind: "Rain&Wind", wind: "Wind", lightning: "Inkuba" };
const RISK_COLORS = { high: "#e0393e", moderate: "#e8951e", low: "#1a9ad6", no_risk: "#1fae6b" };
const RISK_LABELS = { high: "High", moderate: "Moderate", low: "Low", no_risk: "No risk" };
const HOUSE_LABELS = { roof_blown_off_d: "Roof", walls_damaged: "Wall", lightly_damaged: "Slightly", flooded_water_entered: "Flooded", completely_destroyed: "Completely", high_risk_zone: "HRZ", no_problem: "No problem" };
const FAC_TYPE_LABELS = option_labels("cascading_select_3ec652");
const HOT_TYPE_LABELS = option_labels("cascading_select_b49b76");

const eq = (field_id, value) => ({ field_id, operator: "eq", value });
const purpose = (value) => eq(F.PURPOSE, value);

/** A widget's look beyond the default white card: only what the widget needs. */
const look = (extra) => (extra && Object.keys(extra).length > 0 ? Object.assign({ theme: "light" }, extra) : null);

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
      pinned_fields: [],
    },
    extra,
  );
}

/** The HTML's title band: a text block, heading only, centred, a whole row. */
const banner = (id, heading) => widget(id, "text", { size: "large", text: { heading, body: "", align: "center", size: "lg" } });

/**
 * An observation block: the HTML's `text()` box. Its figures are LIVE -
 * {{count(...)}}, {{sum(...)}}, {{share(...)}} computed under the board's
 * filters and date - so it carries the module its figures count within
 * (filters) like every other widget of its board.
 */
const note = (id, heading, body, filters, extra) =>
  widget(id, "text", {
    size: "medium",
    filters: filters || [],
    text: { heading: heading || "", body, align: "left", size: "md", accent: "#056daa" },
    ...(extra || {}),
  });

/** One district card (the HTML's `card(name, value)`), pinned so a district filter never hides its neighbours. */
const district_card = (id, title, district, filters) =>
  widget(id, "kpi", { title, size: "small", filters: [eq(F.DISTRICT, district)].concat(filters), pinned_fields: [F.DISTRICT] });

/** The HTML's `total(v)` box. */
const total_card = (id, title, filters) => widget(id, "kpi", { title, size: "small", filters, pinned_fields: [F.DISTRICT] });

/** The HTML's `dist(a, b, c, t)` row: one card per district and a total, named for what they count. */
const district_row = (prefix, what, filters, with_total) =>
  DISTRICTS.map((district, index) => district_card(`${prefix}_${index + 1}`, `${district} - ${what}`, district, filters)).concat(with_total === false ? [] : [total_card(`${prefix}_tot`, `TOT - ${what}`, filters)]);

/** A summary table with measure columns: the HTML's `table(head, rows)` with a Total row. */
const measure_table = (id, title, group_field, columns, filters, extra) =>
  widget(id, "table", {
    title,
    group_by: { field_id: group_field },
    filters,
    sort: "label_asc",
    limit: 50,
    size: "large",
    table: { mode: "summary", columns, totals: { row: true, column: false } },
    appearance: look({ compact: false }),
    pinned_fields: group_field === F.DISTRICT ? [F.DISTRICT] : [],
    ...(extra || {}),
  });

const sum_of = (key, label, field_id) => ({ key, label, aggregation: "sum", field_id, filters: [] });
const count_where = (key, label, filters) => ({ key, label, aggregation: "count", field_id: null, filters });

/** The HTML's stacked horizontal bars, coloured by hazard or by risk. */
const stacked = (id, title, group_field, split_field, filters, colors, labels, extra) =>
  widget(id, "stacked_bar", {
    title,
    size: "medium",
    group_by: { field_id: group_field },
    split_by: { field_id: split_field },
    filters,
    limit: 20,
    appearance: look({ value_colors: colors, value_labels: labels, legend_position: "bottom" }),
    ...(extra || {}),
  });

/** The HTML's `line(peaks)`: records per month of the incidence date. */
const trend = (id, title, filters) => widget(id, "line", { title, size: "large", group_by: { field_id: F.INCIDENT_TIME, granularity: "month" }, filters });

const HOUSEHOLD = [purpose("household_loss")];
const INFRA = [purpose("infrastructure")];
const HOTSPOT = [purpose("hotspot")];
const COMMON_FILTERS = [{ field_id: F.DISTRICT }, { field_id: F.SECTOR }, { field_id: F.DRIVER }];

// Tokens of the live figures the notes carry, written once so the notes read.
const v = (formula, inside) => `{{${formula}(${inside})}}`;
const NOTE3 = `Rain and wind events (==${v("sum", `${F.INJURED} | ${F.DRIVER} = rain_wind`)} injuries==) are the main drivers of injuries.\n\nRain events (==${v("sum", `${F.INJURED} | ${F.DRIVER} = heavy_rain`)} injuries, ${v("sum", `${F.MISSING} | ${F.DRIVER} = heavy_rain`)} missing==) present both safety and search-and-rescue challenges.\n\nFire incidents (==${v("sum", `${F.DEATHS} | ${F.DRIVER} = fire`)} deaths==) pose the highest fatality risk and remain a critical life-safety concern.`;
const NOTE4 = `Rain combined with wind hit ==${v("count", `${F.DRIVER} = rain_wind`)} of {{count}} facilities (${v("share", `${F.DRIVER} = rain_wind`)})== and heavy rain another ==${v("count", `${F.DRIVER} = heavy_rain`)} (${v("share", `${F.DRIVER} = heavy_rain`)})== - the two most destructive hazards by far.\n\nFire caused ==${v("count", `${F.DRIVER} = fire`)} hits== (${v("share", `${F.DRIVER} = fire`)}), mostly on community buildings, schools and agricultural facilities.\n\nWind alone accounts for ==${v("count", `${F.DRIVER} = wind`)} facilities== - the lowest hazard threat across all asset types.`;
const district_line = (name, opening) =>
  `${name} (==${v("count", `${F.DISTRICT} = ${name}`)} | ${v("share", `${F.DISTRICT} = ${name}`)}==) ${opening}, with impacts driven by rain (==${v("count", `${F.DRIVER} = heavy_rain | ${F.DISTRICT} = ${name}`)}==), rain & wind (==${v("count", `${F.DRIVER} = rain_wind | ${F.DISTRICT} = ${name}`)}==) and fire (==${v("count", `${F.DRIVER} = fire | ${F.DISTRICT} = ${name}`)}==).`;
const NOTE5 = `${district_line("Gasabo", "carries the largest share of the households affected")}\n\n${district_line("Nyarugenge", "faces significant urban risk")}\n\n${district_line("Kicukiro", "records the remaining impacts")}`;
const NOTE6 = `**OBSERVATIONS**\nHigh-risk hotspots (==${v("share", `${F.RISK} = high`)}==, ${v("count", `${F.RISK} = high`)} of {{count}}) indicate severe and escalating vulnerability across the City of Kigali, requiring urgent and coordinated action. Kicukiro District has logged ==${v("count", `${F.DISTRICT} = Kicukiro`)} hotspots==, Gasabo ${v("count", `${F.DISTRICT} = Gasabo`)} and Nyarugenge ${v("count", `${F.DISTRICT} = Nyarugenge`)} - the district leading in identification and monitoring reflects an operational efficiency to be replicated, while confirming uneven but widespread risk exposure.\n\n**RECOMMENDATION**\nPrioritize immediate intervention in the ==${v("count", `${F.RISK} = high`)} high-risk hotspots== through drainage improvement, slope stabilization, relocation, and strict enforcement of land-use regulations.`;
const asset = (type) => `${v("count", `${F.RISK} = high | ${F.HOT_TYPE} = ${type}`)} High-risk sites out of ${v("count", `${F.HOT_TYPE} = ${type}`)}`;
const NOTE7 = `Ravines lead with ==${asset("ravines")}== - the most critical asset in Kigali. Retaining walls at risk (==${asset("retaining_walls_at_risk")}==) and old, poorly-built housing (==${asset("old_poorly_built_housing")}==) confirm landslide and housing risk are top priorities. Out of {{count}} hotspots, only ${v("count", `${F.RISK} = no_risk`)} are rated No Risk.\n\n**Moderate Risk: the Next Wave**\nSteep or fragile slopes hold ==${v("count", `${F.RISK} = moderate | ${F.HOT_TYPE} = steep_fragile_slope`)} Moderate sites== of ${v("count", `${F.HOT_TYPE} = steep_fragile_slope`)}, all trending toward High. In all, ==${v("count", `${F.RISK} = moderate`)} hotspots== are the next High-risk wave if unmitigated.`;

const boards = [];

// 1. Disaster impact on HH by district
boards.push({
  file: "01-impact-on-households-by-district.json",
  name: "Disaster impact on HH by district",
  filters: COMMON_FILTERS,
  widgets: [
    banner("d1_hh_title", "DISASTER IMPACT ON HH BY DISTRICT"),
    ...district_row("d1_hh", "households", HOUSEHOLD),
    measure_table(
      "d1_hh_table",
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
    banner("d1_fac_title", "DISASTER IMPACTS ON FACILITY BY DISTRICT"),
    ...district_row("d1_fac", "facilities", INFRA),
    widget("d1_fac_table", "table", {
      title: "Facilities affected per district and type of facility",
      group_by: { field_id: F.DISTRICT },
      split_by: { field_id: F.FAC_TYPE },
      filters: INFRA,
      sort: "label_asc",
      limit: 50,
      size: "large",
      table: { mode: "summary", columns: [], totals: { row: true, column: true } },
      appearance: look({ compact: false, value_labels: FAC_TYPE_LABELS }),
      pinned_fields: [F.DISTRICT],
    }),
  ],
});

// 2. Spatial distribution - disaster impact on housing
{
  const damaged = HOUSEHOLD.concat([eq(F.HOUSE_DAMAGED, "yes")]);
  boards.push({
    file: "02-spatial-distribution-housing.json",
    name: "Spatial distribution - disaster impact on housing",
    filters: COMMON_FILTERS,
    widgets: [
      banner("d2_title", "SPATIAL DISTRIBUTION OF DISASTER IMPACT ON HOUSING IN THE CITY OF KIGALI"),
      ...district_row("d2", "damaged houses", damaged),
      stacked("d2_damage", "How houses were damaged, by hazard", F.HOUSE_HOW, F.DRIVER, damaged, HAZARD_COLORS, Object.assign({}, HAZARD_LABELS, HOUSE_LABELS), { size: "large" }),
      trend("d2_trend", "Damaged houses per month of incidence", damaged),
    ],
  });
}

// 3. Spatial distribution - hazard and health impacts
boards.push({
  file: "03-spatial-distribution-hazard-health.json",
  name: "Spatial distribution - hazard and health impacts",
  filters: COMMON_FILTERS,
  widgets: [
    banner("d3_title", "SPATIAL DISTRIBUTION OF HAZARD IMPACTS AND HEALTH IMPACTS IN KIGALI"),
    // The HTML names the districts here without a total: no TOT card.
    ...district_row("d3", "households", HOUSEHOLD, false),
    widget("d3_mosaic", "treemap", {
      title: "Deaths by hazard",
      size: "medium",
      metric: { aggregation: "sum", field_id: F.DEATHS },
      group_by: { field_id: F.DRIVER },
      filters: HOUSEHOLD,
      limit: 12,
      appearance: look({ value_colors: HAZARD_COLORS, value_labels: HAZARD_LABELS }),
    }),
    note("d3_note", "HEALTH IMPACTS VS HAZARDS", NOTE3, HOUSEHOLD),
    measure_table("d3_table", "Casualties per hazard", F.DRIVER, [sum_of("deaths", "Deaths", F.DEATHS), sum_of("injured", "Injured", F.INJURED), sum_of("trauma", "Trauma", F.TRAUMA), sum_of("missing", "Missing", F.MISSING)], HOUSEHOLD, {
      appearance: look({ compact: false, value_labels: HAZARD_LABELS }),
    }),
  ],
});

// 4. Spatial distribution - facility impacts
boards.push({
  file: "04-spatial-distribution-facilities.json",
  name: "Spatial distribution - facility impacts",
  filters: COMMON_FILTERS,
  widgets: [
    banner("d4_title", "SPATIAL DISTRIBUTION OF DISASTER IMPACTS ON FACILITY IN THE CITY OF KIGALI"),
    ...district_row("d4", "facilities", INFRA),
    stacked("d4_facilities", "Facilities affected, by type and hazard", F.FAC_TYPE, F.DRIVER, INFRA, HAZARD_COLORS, Object.assign({}, HAZARD_LABELS, FAC_TYPE_LABELS)),
    note("d4_note", "Facilities vs. Hazards", NOTE4, INFRA),
  ],
});

// 5. Spatial distribution - districts vs hazards
boards.push({
  file: "05-spatial-distribution-districts-vs-hazards.json",
  name: "Spatial distribution - districts vs hazards",
  filters: COMMON_FILTERS,
  widgets: [
    banner("d5_title", "SPATIAL DISTRIBUTION OF HAZARD IMPACTS AND HEALTH IMPACTS"),
    ...district_row("d5", "households", HOUSEHOLD),
    stacked("d5_districts", "Households affected per district, by hazard", F.DISTRICT, F.DRIVER, HOUSEHOLD, HAZARD_COLORS, HAZARD_LABELS, { pinned_fields: [F.DISTRICT] }),
    note("d5_note", "DISTRICTS vs HAZARDS", NOTE5, HOUSEHOLD, { pinned_fields: [F.DISTRICT] }),
    trend("d5_trend", "Households affected per month of incidence", HOUSEHOLD),
  ],
});

// 6. Hotspot identification and monitoring - summary
{
  // The HTML's four coloured tiles: a card each, the risk colour on the number.
  const tile = (id, value) =>
    widget(id, "kpi", {
      title: RISK_LABELS[value],
      size: "small",
      filters: HOTSPOT.concat([eq(F.RISK, value)]),
      appearance: look({ light: { number: RISK_COLORS[value] } }),
      pinned_fields: [F.RISK],
    });
  boards.push({
    file: "06-hotspot-monitoring-summary.json",
    name: "Hotspot identification and monitoring - summary",
    filters: COMMON_FILTERS.concat([{ field_id: F.RISK }]),
    widgets: [
      banner("d6_title", "REPORT ON HOTSPOT IDENTIFICATION AND MONITORING"),
      ...district_row("d6", "hotspots", HOTSPOT),
      tile("d6_high", "high"),
      tile("d6_moderate", "moderate"),
      tile("d6_low", "low"),
      tile("d6_none", "no_risk"),
      note("d6_note", "", NOTE6, HOTSPOT, { size: "large", pinned_fields: [F.DISTRICT, F.RISK] }),
    ],
  });
}

// 7. Hotspot identification and monitoring - assets
boards.push({
  file: "07-hotspot-monitoring-assets.json",
  name: "Hotspot identification and monitoring - assets",
  filters: COMMON_FILTERS.concat([{ field_id: F.RISK }]),
  widgets: [
    banner("d7_title", "REPORT ON HOTSPOT IDENTIFICATION AND MONITORING"),
    ...district_row("d7", "hotspots", HOTSPOT),
    stacked("d7_assets", "Hotspots by type of asset and risk status", F.HOT_TYPE, F.RISK, HOTSPOT, RISK_COLORS, Object.assign({}, RISK_LABELS, HOT_TYPE_LABELS), { sort: "value_desc", limit: 20 }),
    note("d7_note", "Dominant High-Risk Assets", NOTE7, HOTSPOT, { pinned_fields: [F.RISK] }),
    trend("d7_trend", "Hotspots logged per month of incidence", HOTSPOT),
  ],
});

// Write the files: positions in array order, one document per board.
const written = boards.map((board) => {
  const widgets = board.widgets.map((entry, index) => Object.assign(entry, { position: index }));
  const document = { name: board.name, filters: board.filters, widgets };
  fs.writeFileSync(path.join(__dirname, board.file), JSON.stringify(document, null, 2) + "\n");
  return { file: board.file, widgets: widgets.length };
});
written.forEach((entry) => console.log(`${entry.file}: ${entry.widgets} widgets`));
console.log(`${written.length} boards written`);
