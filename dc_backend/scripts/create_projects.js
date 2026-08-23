require("dotenv").config({ quiet: true });
const connect_databases = require("../db_connection/main.js");
const { get_db } = require("../db_connection/db.js");
const projects_model = require("../models/projects_model.js");
const users_model = require("../models/users_model.js");

/**
 * Standalone bulk-seed script: creates every project listed in
 * "Urban Economic department"'s unit-by-unit data collection inventory
 * (see file.csv at the repo root), skipping forms entirely - only the
 * project shell (name + description + department/unit labels) is created.
 *
 * Usage: node scripts/create_projects.js
 *
 * The department itself does not exist yet as a record in cok.departments
 * (the closest match there is a differently-spelled "Ubarn Economy"), and
 * none of these units exist there either, so department_id/department_unit_id
 * are left null and only the plain-text department_name/department_unit_name
 * labels are stored - dc_backend does not validate these against a real
 * department/unit record at write time. Once the department and its units
 * are created for real in cok.departments, their ids can be filled in here
 * (or patched onto these projects afterwards) to link them properly.
 */
const CREATED_BY_EMAIL = "parfaituwayo@gmail.com";
const DEPARTMENT_NAME = "Urban Economic department";

const UNITS = [
  {
    unit_name: "Urban and Peri urban Agriculture",
    projects: [
      {
        name: "Girinka",
        description:
          "Tracks Girinka (One Cow Per Poor Family) beneficiaries and their cows: beneficiary and location details, ear tag number, status (alive, sold, dead), source (e.g. Inkomoko, Gahunda ya Girinka), pass-on details, and partner (NGO/development partner) support.",
      },
      {
        name: "Cows inseminated",
        description:
          "Records artificial insemination events for cows: date of insemination, farmer and location details, and the cow's ear tag number.",
      },
      {
        name: "Calves recorded",
        description:
          "Tracks calves born from inseminated cows: date recorded, date of birth, farmer's name, breed of the calf, and mother's ear tag ID.",
      },
      {
        name: "Insurance (Cows, goats, pig, ...)",
        description:
          "Tracks livestock insurance coverage across animal types: ear tag number, farmer name, animal type, insurance provider, compensation paid, premium payment status, and full address location.",
      },
      {
        name: "Land use consolidation per categories (maize, vegetables, beans, rice)",
        description:
          "Tracks consolidated land use per crop category: farmer identity and contact, cooperative membership, land parcel ID and size, crop category/variety, fertilizer use, irrigation, and crop insurance data for maize and rice.",
      },
      {
        name: "Fertilizers",
        description:
          "Tracks fertilizer distribution and use: farmer address, land parcel ID and size, fertilizer type/name, quantity applied, application date, supplier, cost, season, and agro-dealer details.",
      },
      {
        name: "Forest rehabilitation (ha)",
        description: "Tracks forest rehabilitation activities by location and area (hectares) rehabilitated.",
      },
      {
        name: "Tree plantation and Agroforestry (ha)",
        description:
          "Tracks tree planting by location, plantation category (ornamental, fruit, indigenous, agroforestry, commercial forest, shade, bamboo, etc.), and number of trees planted.",
      },
      {
        name: "Cold rooms established",
        description:
          "Tracks cold storage room infrastructure: location, establishment date, ownership, purpose, and storage capacity.",
      },
      {
        name: "Coffee plantation and production",
        description: "Tracks coffee farms and production: farm location and number of coffee trees.",
      },
      {
        name: "Livestock farming per categories",
        description: "Tracks livestock farming activity by location and farm address, across livestock categories.",
      },
    ],
  },
  {
    unit_name: "KESC",
    projects: [
      {
        name: "Cooperatives registered (per categories)",
        description:
          "Tracks registered cooperatives: sector, cooperative name, field/activity, location, and total number of members.",
      },
      {
        name: "Job created per categories (all sectors of economie)",
        description:
          "Tracks jobs created across all economic sectors: beneficiary identity, sex, disability status, sector/cell, education level, economic activity category, employer, date of job creation, contract type, and phone number.",
      },
      {
        name: "Work place learning / Internship per categories",
        description:
          "Tracks workplace learning placements: beneficiary details, youth/sex status, field of study, type of placement (professional internship, academic internship/industrial attachment, apprenticeship), duration, hosting organization, and hosting sector (public/private/NGO).",
      },
      {
        name: "Unemployed people (Youth, Women, Men)",
        description:
          "Tracks unemployed residents by demographic group: ID, names, sex, date of birth, age, phone number, full administrative location (province to village), and rural/urban classification.",
      },
      {
        name: "Micro, Small, and Medium Enterprises per categories",
        description: "Tracks micro, small, and medium enterprises across business categories.",
      },
      {
        name: "Street vendors (Youth, Women, Men)",
        description:
          "Tracks registered street vendors by demographic group: name, sector, ID, phone number, goods sold, and market location.",
      },
      {
        name: "Market and mini markets per categories",
        description: "Tracks markets and mini markets across categories.",
      },
      {
        name: "TVET, TSS, Innovation hubs, Hanga Hubs",
        description: "Tracks TVET schools, TSS institutions, innovation hubs, and Hanga hubs.",
      },
      { name: "Incubation Centres", description: "Tracks business incubation centres." },
      { name: "Yego Centres", description: "Tracks Yego centres." },
      {
        name: "Informal businesses and employment per categories",
        description: "Tracks informal businesses and employment across categories.",
      },
      { name: "Recruiting Agencies", description: "Tracks recruiting agencies operating in the city." },
      { name: "Training centres", description: "Tracks vocational and skills training centres." },
      { name: "Skill councils", description: "Tracks skill councils." },
      {
        name:
          "Development partners, NGOs and Private sectors acting in skills development, workplace learning and employment promotions / per categories",
        description:
          "Tracks development partners, NGOs, and private sector actors supporting skills development, workplace learning, and employment promotion, by category.",
      },
      { name: "NEET per categories", description: "Tracks youth Not in Education, Employment, or Training (NEET), by category." },
      {
        name: "Beneficiaries supported through VUP FS per categories",
        description:
          "Tracks VUP Financial Services beneficiaries: identity, gender, location, project name, loan disbursement and maturity dates, loan amount and interest, repayment schedule, outstanding balance, repayment rate, and overdue defaults.",
      },
      {
        name: "Amatsinda",
        description:
          "Tracks Amatsinda (savings/cooperative group) beneficiaries: identity, gender, location, project name, loan disbursement and maturity dates, loan amount and interest, repayment schedule, outstanding balance, repayment rate, and overdue defaults.",
      },
      {
        name: "Young entrepreneurs supported/or received grants or start up capital per sources",
        description: "Tracks young entrepreneurs supported with grants or start-up capital, by funding source.",
      },
    ],
  },
  {
    unit_name: "Tourism promotion",
    projects: [
      { name: "Parks", description: "Tracks parks as touristic attractions." },
      { name: "Community-Based Tourism (CBTs)", description: "Tracks Community-Based Tourism sites." },
      {
        name: "Historical Monuments / Heritage Sites",
        description: "Tracks historical monuments and heritage sites.",
      },
      { name: "Museums", description: "Tracks museums as touristic attractions." },
      { name: "Hotels", description: "Tracks hotels as hospitality and tourism support facilities." },
      { name: "Motels", description: "Tracks motels as hospitality and tourism support facilities." },
      { name: "Apartments", description: "Tracks apartments as hospitality and tourism support facilities." },
      { name: "Restaurants", description: "Tracks restaurants as hospitality and tourism support facilities." },
      { name: "Bars (hospitality)", description: "Tracks bars as hospitality and tourism support facilities." },
      { name: "Nightclubs", description: "Tracks nightclubs as hospitality and tourism support facilities." },
      {
        name: "Entertainment venues and Sports facilities",
        description: "Tracks entertainment venues and sports facilities.",
      },
      { name: "Handicraft Shops", description: "Tracks handicraft shops as hospitality and tourism support facilities." },
      {
        name: "Lodges",
        description:
          "Tracks registered lodges: owner/shareholder identity and gender, ID, phone, email, number of employees by gender/youth, number of rooms, and full location.",
      },
      {
        name: "Resorts",
        description:
          "Tracks registered resorts: owner/shareholder identity and gender, ID, phone, email, number of employees by gender/youth, and full location.",
      },
      {
        name: "Bars (investment)",
        description:
          "Tracks registered bars: owner/shareholder identity and gender, ID, phone, email, number of employees by gender/youth, and full location.",
      },
      {
        name: "Residential houses",
        description:
          "Tracks registered residential houses: owner/shareholder identity and gender, ID, phone, email, number of employees by gender/youth, number of rooms, and full location.",
      },
      {
        name: "Affordable housing",
        description:
          "Tracks affordable housing units: owner/shareholder identity and gender, ID, phone, email, number of employees by gender/youth, and full location.",
      },
      {
        name: "Commercial building",
        description:
          "Tracks commercial buildings: owner/shareholder identity and gender, ID, phone, email, number of employees by gender/youth, occupation rate, and full location.",
      },
      {
        name: "Garages",
        description:
          "Tracks registered garages: owner/shareholder identity and gender, ID, phone, email, number of employees by gender/youth, and full location.",
      },
      {
        name: "Car Wash/Ikinamba",
        description:
          "Tracks registered car washes (Ikinamba): owner/shareholder identity and gender, ID, phone, email, number of employees by gender/youth, and full location.",
      },
      {
        name: "Saloons",
        description:
          "Tracks registered saloons: owner/shareholder identity and gender, ID, phone, email, number of employees by gender/youth, and full location.",
      },
      {
        name: "ICPCs (Udukiriro)",
        description: "Tracks ICPCs (Udukiriro): number of beneficiaries by gender/youth, location, and activities carried out.",
      },
      {
        name: "Industries",
        description:
          "Tracks registered industries: owner/shareholder identity and gender, ID, phone, email, number of employees by gender/youth, and full location.",
      },
      {
        name: "Forex Bureau",
        description:
          "Tracks registered forex bureaus: owner identity and gender, ID, phone, email, number of employees by gender/youth, and full location.",
      },
      {
        name: "Development Bank",
        description:
          "Tracks development banks: owner/shareholder identity and gender, ID, phone, email, number of employees by gender/youth, and full location.",
      },
      {
        name: "Insurance companies",
        description:
          "Tracks insurance companies: representative/manager identity and gender, ID, phone, email, number of employees by gender/youth, and full location.",
      },
      {
        name: "Microfinance Institutions (MFIs)",
        description:
          "Tracks microfinance institutions: representative/manager identity and gender, ID, phone, email, number of employees by gender/youth, and full location.",
      },
      {
        name: "Commercial banks",
        description:
          "Tracks commercial banks: representative/manager identity and gender, ID, phone, email, number of employees by gender/youth, and full location.",
      },
      {
        name: "Petro stations",
        description:
          "Tracks petrol stations: owner/shareholder identity and gender, ID, phone, email, number of employees by gender/youth, and full location.",
      },
      {
        name: "Business registered per categories (Mobile Money Providers, ...)",
        description:
          "Tracks other registered businesses by category (e.g. mobile money providers): owner/shareholder identity and gender, ID, phone, email, number of employees by gender/youth, and full location.",
      },
      {
        name: "Mining and quaries",
        description:
          "Tracks mining and quarry sites: owner/shareholder identity and gender, ID, phone, email, number of employees by gender/youth, and full location.",
      },
    ],
  },
];

async function run() {
  const connection_result = await connect_databases();
  if (!connection_result.status) {
    console.error("Could not connect to the database:", connection_result.error);
    process.exit(1);
  }

  const created_by_user = await users_model.find_user_by_email(CREATED_BY_EMAIL);
  if (!created_by_user) {
    console.error(`No cok.users account found for ${CREATED_BY_EMAIL} - cannot set created_by/created_by_name.`);
    process.exit(1);
  }

  const existing_projects = await get_db()
    .collection("dcs_projects")
    .find({ department_name: DEPARTMENT_NAME }, { projection: { name: 1, department_unit_name: 1 } })
    .toArray();
  const existing_key = (name, unit_name) => `${unit_name}::${name}`;
  const existing_keys = new Set(existing_projects.map((p) => existing_key(p.name, p.department_unit_name)));

  let created_count = 0;
  let skipped_count = 0;

  for (const unit of UNITS) {
    for (const project of unit.projects) {
      const key = existing_key(project.name, unit.unit_name);
      if (existing_keys.has(key)) {
        console.log(`Skipped (already exists): [${unit.unit_name}] ${project.name}`);
        skipped_count += 1;
        continue;
      }

      const created = await projects_model.create_project({
        name: project.name,
        description: project.description,
        department_id: null,
        department_name: DEPARTMENT_NAME,
        department_unit_id: null,
        department_unit_name: unit.unit_name,
        access_control_enabled: false,
        dashboard_enabled: false,
        created_by: created_by_user.user_id,
        created_by_name: created_by_user.full_name,
      });
      console.log(`Created: [${unit.unit_name}] ${project.name} (${created._id.toString()})`);
      created_count += 1;
    }
  }

  console.log(`\nDone. Created ${created_count} project(s), skipped ${skipped_count} already-existing one(s).`);
  process.exit(0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
