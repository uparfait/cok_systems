const locations_data = require("../../../location.min.json");

const PROVINCE_TRANSLATIONS = {
  "Umujyi wa Kigali": { en: "Kigali City", kn: "Umujyi wa Kigali", fr: "Ville de Kigali" },
  "Amajyepfo": { en: "Southern Province", kn: "Amajyepfo", fr: "Province du Sud" },
  "Iburengerazuba": { en: "Western Province", kn: "Iburengerazuba", fr: "Province de l'Ouest" },
  "Amajyaruguru": { en: "Northern Province", kn: "Amajyaruguru", fr: "Province du Nord" },
  "Iburasirazuba": { en: "Eastern Province", kn: "Iburasirazuba", fr: "Province de l'Est" }
};

function find_in_array(arr, name) {
  if (!Array.isArray(arr)) return null;
  const searchName = String(name || "").toLowerCase().trim();
  return arr.find(item => {
    if (!Array.isArray(item)) return false;
    const itemName = String(item[0] || "").toLowerCase().trim();
    if (itemName === searchName) return true;
    const translations = PROVINCE_TRANSLATIONS[item[0]];
    if (translations) {
      return Object.values(translations).some(t => t.toLowerCase().trim() === searchName);
    }
    return false;
  });
}

function get_province_key(name) {
  if (!name) return null;
  const searchName = String(name).toLowerCase().trim();
  for (const [key, translations] of Object.entries(PROVINCE_TRANSLATIONS)) {
    if (key.toLowerCase() === searchName) return key;
    if (Object.values(translations).some(t => t.toLowerCase().trim() === searchName)) {
      return key;
    }
  }
  return name;
}

function build_location_tree() {
  const tree = {};
  for (const [country, countryData] of Object.entries(locations_data)) {
    tree[country] = {
      provinces: []
    };
    const provinces = countryData?.P || [];
    for (const province of provinces) {
      if (!Array.isArray(province) || !province[0]) continue;
      const provinceName = province[0];
      const provinceKey = get_province_key(provinceName);
      const provinceNode = {
        name: provinceName,
        translations: PROVINCE_TRANSLATIONS[provinceName] || { en: provinceName, kn: provinceName, fr: provinceName },
        districts: []
      };
      const districts = province[1] || [];
      for (const district of districts) {
        if (!Array.isArray(district) || !district[0]) continue;
        const districtNode = {
          name: district[0],
          sectors: []
        };
        const sectors = district[1] || [];
        for (const sector of sectors) {
          if (!Array.isArray(sector) || !sector[0]) continue;
          const sectorNode = {
            name: sector[0],
            cells: []
          };
          const cells = sector[1] || [];
          for (const cell of cells) {
            if (!Array.isArray(cell) || !cell[0]) continue;
            const cellNode = {
              name: cell[0],
              villages: Array.isArray(cell[1]) ? cell[1] : []
            };
            sectorNode.cells.push(cellNode);
          }
          districtNode.sectors.push(sectorNode);
        }
        provinceNode.districts.push(districtNode);
      }
      tree[country].provinces.push(provinceNode);
    }
  }
  return tree;
}

const location_tree = build_location_tree();

function get_provinces(country, language = "en") {
  if (!country || !location_tree[country]) return [];
  return location_tree[country].provinces.map(p => ({
    key: p.name,
    label: p.translations[language] || p.translations.en || p.name
  }));
}

function get_districts(country, province, language = "en") {
  if (!country || !province) return [];
  const country_data = location_tree[country];
  if (!country_data) return [];
  const province_key = get_province_key(province);
  const province_data = country_data.provinces.find(p => p.name === province_key);
  if (!province_data) return [];
  return province_data.districts.map(d => ({ key: d.name, label: d.name }));
}

function get_sectors(country, province, district, language = "en") {
  if (!country || !province || !district) return [];
  const country_data = location_tree[country];
  if (!country_data) return [];
  const province_key = get_province_key(province);
  const province_data = country_data.provinces.find(p => p.name === province_key);
  if (!province_data) return [];
  const district_data = province_data.districts.find(d => d.name === district);
  if (!district_data) return [];
  return district_data.sectors.map(s => ({ key: s.name, label: s.name }));
}

function get_cells(country, province, district, sector, language = "en") {
  if (!country || !province || !district || !sector) return [];
  const country_data = location_tree[country];
  if (!country_data) return [];
  const province_key = get_province_key(province);
  const province_data = country_data.provinces.find(p => p.name === province_key);
  if (!province_data) return [];
  const district_data = province_data.districts.find(d => d.name === district);
  if (!district_data) return [];
  const sector_data = district_data.sectors.find(s => s.name === sector);
  if (!sector_data) return [];
  return sector_data.cells.map(c => ({ key: c.name, label: c.name }));
}

function get_villages(country, province, district, sector, cell, language = "en") {
  if (!country || !province || !district || !sector || !cell) return [];
  const country_data = location_tree[country];
  if (!country_data) return [];
  const province_key = get_province_key(province);
  const province_data = country_data.provinces.find(p => p.name === province_key);
  if (!province_data) return [];
  const district_data = province_data.districts.find(d => d.name === district);
  if (!district_data) return [];
  const sector_data = district_data.sectors.find(s => s.name === sector);
  if (!sector_data) return [];
  const cell_data = sector_data.cells.find(c => c.name === cell);
  if (!cell_data) return [];
  return cell_data.villages;
}

async function get_locations(req, res) {
  try {
    const { country = "Rwanda", province, district, sector, cell, language = "en" } = req.query;

    let result;
    let level;

    if (cell) {
      result = get_villages(country, province, district, sector, cell, language);
      level = "villages";
    } else if (sector) {
      result = get_cells(country, province, district, sector, language);
      level = "cells";
    } else if (district) {
      result = get_sectors(country, province, district, language);
      level = "sectors";
    } else if (province) {
      result = get_districts(country, province, language);
      level = "districts";
    } else if (country) {
      result = get_provinces(country, language);
      level = "provinces";
    } else {
      result = Object.keys(location_tree);
      level = "countries";
    }

    return res.status(200).json({
      success: true,
      data: result,
      level
    });
  } catch (error) {
    console.error("[LOCATIONS ERROR]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch locations",
      error: error.message
    });
  }
}

async function get_all_locations(req, res) {
  try {
    const { language = "en" } = req.query;
    const tree = build_location_tree();

    if (language !== "en") {
      for (const country of Object.values(tree)) {
        for (const province of country.provinces) {
          province.display_name = province.translations[language] || province.translations.en || province.name;
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: tree,
      language
    });
  } catch (error) {
    console.error("[LOCATIONS ERROR]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch locations",
      error: error.message
    });
  }
}

module.exports = {
  get_locations,
  get_all_locations,
  location_tree,
  PROVINCE_TRANSLATIONS
};
