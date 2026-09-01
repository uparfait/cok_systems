/**
 * Seed script to create the system "Address" template.
 * Run with: node dc_backend/seed_address_template.js
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env"), quiet: true });

const { MongoClient, ObjectId } = require("mongodb");
const config = require("./configurations/config.js");

const COLLECTION_NAME = "dcs_templates";
const ADDRESS_TEMPLATE_ID = "6a958a98301d62d7076341ad";

function generate_id() {
  return Math.random().toString(36).slice(2, 10);
}

async function seed_address_template() {
  let client;
  try {
    client = new MongoClient(config.connection_string);
    await client.connect();
    const db = client.db();

    // Delete existing template with the fixed ID
    const objectId = new ObjectId(ADDRESS_TEMPLATE_ID);
    const deleteResult = await db.collection(COLLECTION_NAME).deleteOne({
      _id: objectId
    });

    if (deleteResult.deletedCount > 0) {
      console.log(`Deleted existing Address template with ID: ${ADDRESS_TEMPLATE_ID}`);
    }

    // Also delete any template with name "address"
    await db.collection(COLLECTION_NAME).deleteMany({
      name_normalized: "address",
      _id: { $ne: objectId }
    });

    const province_id = `cascading_select_${generate_id()}`;
    const district_id = `cascading_select_${generate_id()}`;
    const sector_id = `cascading_select_${generate_id()}`;
    const cell_id = `cascading_select_${generate_id()}`;
    const village_id = `cascading_select_${generate_id()}`;

    const template = {
      name: "Address",
      name_normalized: "address",
      description: "Rwanda administrative address template with cascading location selects (Province --> District --> Sector --> Cell --> Village)",
      is_system_template: true,
      created_by: "system",
      created_by_name: "System",
      created_at: new Date(),
      updated_at: new Date(),
      fields: [
        {
          id: province_id,
          type: "cascading_select",
          label: {
            en: "Province",
            kn: "Intara",
            fr: "Province"
          },
          placeholder: {
            en: "Select Province",
            kn: "Hitamo Intara",
            fr: "Sélectionner la Province"
          },
          help_text: {
            en: "Select the province or city",
            kn: "Hitamo intara.",
            fr: "Sélectionnez la province ou la ville"
          },
          mandatory: true,
          default_value: null,
          visibility_condition: null,
          validation_rules: [],
          computed: { enabled: false, formula: null },
          design: {
            offset_percent: 0,
            full_device_width: false,
            width_percent: null,
            text_color: null,
            background_color: null,
            border_enabled: false,
            border_color: "#E0E0E0",
            border_width: 1,
            font_family: null,
            list_type: null
          },
          parent_field_id: null,
          options: [],
          data_source: {
            type: "api",
            url: "/api/locations",
            level: "provinces",
            retry_count: 5
          }
        },
        {
          id: district_id,
          type: "cascading_select",
          label: {
            en: "District",
            kn: "Akarere",
            fr: "District"
          },
          placeholder: {
            en: "Select District",
            kn: "Hitamo Akarere",
            fr: "Sélectionner le District"
          },
          help_text: {
            en: "Select the district",
            kn: "Hitamo akarere",
            fr: "Sélectionnez le district"
          },
          mandatory: true,
          default_value: null,
          visibility_condition: null,
          validation_rules: [],
          computed: { enabled: false, formula: null },
          design: {
            offset_percent: 0,
            full_device_width: false,
            width_percent: null,
            text_color: null,
            background_color: null,
            border_enabled: false,
            border_color: "#E0E0E0",
            border_width: 1,
            font_family: null,
            list_type: null
          },
          parent_field_id: province_id,
          options: [],
          data_source: {
            type: "api",
            url: "/api/locations",
            level: "districts",
            parent_level: "province",
            retry_count: 5
          }
        },
        {
          id: sector_id,
          type: "cascading_select",
          label: {
            en: "Sector",
            kn: "Umurenge",
            fr: "Secteur"
          },
          placeholder: {
            en: "Select Sector",
            kn: "Hitamo Umurenge",
            fr: "Sélectionner le Secteur"
          },
          help_text: {
            en: "Select the sector",
            kn: "Hitamo umurenge",
            fr: "Sélectionnez le secteur"
          },
          mandatory: true,
          default_value: null,
          visibility_condition: null,
          validation_rules: [],
          computed: { enabled: false, formula: null },
          design: {
            offset_percent: 0,
            full_device_width: false,
            width_percent: null,
            text_color: null,
            background_color: null,
            border_enabled: false,
            border_color: "#E0E0E0",
            border_width: 1,
            font_family: null,
            list_type: null
          },
          parent_field_id: district_id,
          options: [],
          data_source: {
            type: "api",
            url: "/api/locations",
            level: "sectors",
            parent_level: "district",
            retry_count: 5
          }
        },
        {
          id: cell_id,
          type: "cascading_select",
          label: {
            en: "Cell",
            kn: "Akagali",
            fr: "Cellule"
          },
          placeholder: {
            en: "Select Cell",
            kn: "Hitamo Akagali",
            fr: "Sélectionner la Cellule"
          },
          help_text: {
            en: "Select the cell",
            kn: "Hitamo akagali",
            fr: "Sélectionnez la cellule"
          },
          mandatory: true,
          default_value: null,
          visibility_condition: null,
          validation_rules: [],
          computed: { enabled: false, formula: null },
          design: {
            offset_percent: 0,
            full_device_width: false,
            width_percent: null,
            text_color: null,
            background_color: null,
            border_enabled: false,
            border_color: "#E0E0E0",
            border_width: 1,
            font_family: null,
            list_type: null
          },
          parent_field_id: sector_id,
          options: [],
          data_source: {
            type: "api",
            url: "/api/locations",
            level: "cells",
            parent_level: "sector",
            retry_count: 5
          }
        },
        {
          id: village_id,
          type: "cascading_select",
          label: {
            en: "Village",
            kn: "Umudugudu",
            fr: "Village"
          },
          placeholder: {
            en: "Select Village",
            kn: "Hitamo Umudugudu",
            fr: "Sélectionner le Village"
          },
          help_text: {
            en: "Select the village",
            kn: "Hitamo umudugudu",
            fr: "Sélectionnez le village"
          },
          mandatory: true,
          default_value: null,
          visibility_condition: null,
          validation_rules: [],
          computed: { enabled: false, formula: null },
          design: {
            offset_percent: 0,
            full_device_width: false,
            width_percent: null,
            text_color: null,
            background_color: null,
            border_enabled: false,
            border_color: "#E0E0E0",
            border_width: 1,
            font_family: null,
            list_type: null
          },
          parent_field_id: cell_id,
          options: [],
          data_source: {
            type: "api",
            url: "/api/locations",
            level: "villages",
            parent_level: "cell",
            retry_count: 5
          }
        }
      ]
    };

    const result = await db.collection(COLLECTION_NAME).insertOne(template);
    console.log("Address template created successfully with ID:", result.insertedId);
  } catch (error) {
    console.error("Error seeding Address template:", error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

seed_address_template();