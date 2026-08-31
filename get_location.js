
const data = require("./location.min.json");

const aliases = {
  "kigali city": ["kigali city", "ville de kigali", "umujyi wa kigali"],
  "southern province": ["southern province", "province du sud", "amajyepfo"],
  "western province": ["western province", "province de l'ouest", "iburengerazuba"],
  "northern province": ["northern province", "province du nord", "amajyaruguru"],
  "eastern province": ["eastern province", "province de l'est", "iburasirazuba"]
};

const norm = s => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
const find = (a,n) => a?.find(x => Array.isArray(x) && (norm(x[0]) === norm(n) || Object.values(aliases).flat().some(v => norm(v) === norm(n) && v.toLowerCase() === x[0].toLowerCase()) || Object.values(aliases).some(v => v.some(a => norm(a) === norm(n) && v.some(z => norm(z) === norm(x[0]))))));
const names = a => Array.isArray(a) ? a.map(x => Array.isArray(x) ? x[0] : x) : [];

const getCountries = () => Object.keys(data);
const getProvinces = c => names(data[c]?.P);
const getDistricts = (c,p) => names(find(data[c]?.P,p)?.[1]);
const getSectors = (c,p,d) => names(find(find(data[c]?.P,p)?.[1],d)?.[1]);
const getCells = (c,p,d,s) => names(find(find(find(data[c]?.P,p)?.[1],d)?.[1],s)?.[1]);
const getVillages = (c,p,d,s,cell) => find(find(find(find(data[c]?.P,p)?.[1],d)?.[1],s)?.[1],cell)?.[1] || [];

module.exports = {getCountries,getProvinces,getDistricts,getSectors,getCells,getVillages};
