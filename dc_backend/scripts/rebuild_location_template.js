require("dotenv").config();
const { MongoClient, ObjectId } = require("mongodb");
const location = require("../../location.json");
const { validate_form_schema } = require("../jsonlogic/validate_schema.js");

const TEMPLATE_ID = "6a8ee2ba594a6ef4b7c129eb";

function tr(text) {
  return { en: text, kn: text, fr: text };
}

function make_option(name) {
  return { id: name, label: tr(name), value: name };
}

const provinces = location.Rwanda.Provinces;
const total_provinces = provinces.length;
const total_districts = provinces.reduce((sum, p) => sum + p.Districts.length, 0);
const total_sectors = provinces.reduce((sum, p) => sum + p.Districts.reduce((s, d) => s + d.Sectors.length, 0), 0);
const total_cells = provinces.reduce(
  (sum, p) => sum + p.Districts.reduce((s, d) => s + d.Sectors.reduce((c, sec) => c + sec.Cells.length, 0), 0),
  0,
);
const total_villages = provinces.reduce(
  (sum, p) =>
    sum +
    p.Districts.reduce(
      (s, d) => s + d.Sectors.reduce((c, sec) => c + sec.Cells.reduce((v, cell) => v + cell.Villages.length, 0), 0),
      0,
    ),
  0,
);

const PROVINCE_FIELD_ID = "select_group_prvnce";
const DISTRICT_FIELD_ID = "select_group_dstrct";
const SECTOR_FIELD_ID = "select_group_sctr";
const CELL_FIELD_ID = "select_group_cell";
const VILLAGE_FIELD_ID = "select_group_vllge";

const province_field = {
  id: PROVINCE_FIELD_ID,
  type: "select_group",
  label: { en: "Province", kn: "Intara", fr: "Province" },
  help_text: { en: "Select the province", kn: "Hitamo intara", fr: "Choisissez la province" },
  options: provinces.map((p) => make_option(p.Name)),
  mandatory: true,
  required_message: { en: "Please select a province", kn: "Hitamo intara", fr: "Veuillez choisir une province" },
  default_value: null,
  validation_rules: [],
  visibility_condition: null,
  design: { spacing_below_px: 16 },
};

const district_groups = provinces.map((p, index) => ({
  id: `dst_grp_${index + 1}`,
  parent_field_id: PROVINCE_FIELD_ID,
  operator: "equals",
  value: p.Name,
  options: p.Districts.map((d) => make_option(d.Name)),
}));

const district_field = {
  id: DISTRICT_FIELD_ID,
  type: "select_group",
  label: { en: "District", kn: "Akarere", fr: "District" },
  help_text: { en: "Select the district", kn: "Hitamo akarere", fr: "Choisissez le district" },
  options: [],
  parent_dependency_enabled: true,
  parent_option_groups: district_groups,
  mandatory: true,
  required_message: { en: "Please select a district", kn: "Hitamo akarere", fr: "Veuillez choisir un district" },
  default_value: null,
  validation_rules: [],
  visibility_condition: null,
  design: { spacing_below_px: 16 },
};

const sector_groups = [];
provinces.forEach((p) => {
  p.Districts.forEach((d) => {
    sector_groups.push({
      id: `sct_grp_${sector_groups.length + 1}`,
      parent_field_id: DISTRICT_FIELD_ID,
      operator: "equals",
      value: d.Name,
      options: d.Sectors.map((s) => make_option(s.Name)),
    });
  });
});

const sector_field = {
  id: SECTOR_FIELD_ID,
  type: "select_group",
  label: { en: "Sector", kn: "Umurenge", fr: "Secteur" },
  help_text: { en: "Select the sector", kn: "Hitamo umurenge", fr: "Choisissez le secteur" },
  options: [],
  parent_dependency_enabled: true,
  parent_option_groups: sector_groups,
  mandatory: true,
  required_message: { en: "Please select a sector", kn: "Hitamo umurenge", fr: "Veuillez choisir un secteur" },
  default_value: null,
  validation_rules: [],
  visibility_condition: null,
  design: { spacing_below_px: 16 },
};

const cell_groups = [];
provinces.forEach((p) => {
  p.Districts.forEach((d) => {
    d.Sectors.forEach((s) => {
      cell_groups.push({
        id: `cel_grp_${cell_groups.length + 1}`,
        parent_field_id: SECTOR_FIELD_ID,
        operator: "equals",
        value: s.Name,
        options: s.Cells.map((c) => make_option(c.Name)),
      });
    });
  });
});

const cell_field = {
  id: CELL_FIELD_ID,
  type: "select_group",
  label: { en: "Cell", kn: "Akagari", fr: "Cellule" },
  help_text: { en: "Select the cell", kn: "Hitamo akagari", fr: "Choisissez la cellule" },
  options: [],
  parent_dependency_enabled: true,
  parent_option_groups: cell_groups,
  mandatory: true,
  required_message: { en: "Please select a cell", kn: "Hitamo akagari", fr: "Veuillez choisir une cellule" },
  default_value: null,
  validation_rules: [],
  visibility_condition: null,
  design: { spacing_below_px: 16 },
};

const village_groups = [];
provinces.forEach((p) => {
  p.Districts.forEach((d) => {
    d.Sectors.forEach((s) => {
      s.Cells.forEach((c) => {
        village_groups.push({
          id: `vlg_grp_${village_groups.length + 1}`,
          parent_field_id: CELL_FIELD_ID,
          operator: "equals",
          value: c.Name,
          options: c.Villages.map((v) => make_option(v.Name)),
        });
      });
    });
  });
});

const village_field = {
  id: VILLAGE_FIELD_ID,
  type: "select_group",
  label: { en: "Village", kn: "Umudugudu", fr: "Village" },
  help_text: { en: "Select the village", kn: "Hitamo umudugudu", fr: "Choisissez le village" },
  options: [],
  parent_dependency_enabled: true,
  parent_option_groups: village_groups,
  mandatory: true,
  required_message: { en: "Please select a village", kn: "Hitamo umudugudu", fr: "Veuillez choisir un village" },
  default_value: null,
  validation_rules: [],
  visibility_condition: null,
  design: { spacing_below_px: 16 },
};

const header_field = {
  id: "header_lctn01",
  type: "header",
  label: { en: "Location", kn: "Aho biherereye", fr: "Emplacement" },
  level: 5,
  design: { spacing_below_px: 16 },
};

const fields = [
  {
    id: "group_lctn01",
    type: "group",
    label: { en: "", kn: "", fr: "" },
    children: [header_field, province_field, district_field, sector_field, cell_field, village_field],
  },
];

const description =
  `Rwanda administrative locations (Province -> District -> Sector -> Cell -> Village). ` +
  `Totals: ${total_provinces} provinces, ${total_districts} districts, ${total_sectors} sectors, ` +
  `${total_cells} cells, ${total_villages} villages.`;

(async () => {
  const validation_result = validate_form_schema({ fields });
  if (!validation_result.valid) {
    console.error("Schema validation failed:", JSON.stringify(validation_result.errors, null, 2));
    process.exit(1);
  }

  const client = new MongoClient(process.env.conne_string);
  await client.connect();
  const db = client.db("data_collection_system");
  const object_id = new ObjectId(TEMPLATE_ID);
  const existing = await db.collection("dcs_templates").findOne({ _id: object_id });
  if (!existing) throw new Error("Template not found");
  await db.collection("dcs_templates").updateOne(
    { _id: object_id },
    { $set: { fields, description, updated_at: new Date() } },
  );
  const updated = await db.collection("dcs_templates").findOne({ _id: object_id });
  console.log("counts:", { total_provinces, total_districts, total_sectors, total_cells, total_villages });
  console.log("updated description:", updated.description);
  console.log("doc size bytes:", JSON.stringify(updated).length);
  await client.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
