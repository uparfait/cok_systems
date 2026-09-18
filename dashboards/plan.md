# DMIS role dashboards - plan and to-do

Source form: `DMIS_Assessment_Form.json` (renumbered: Emergency Response = Section F with F1..F7, Preparedness = Section G, Conclusion = Part H with H1..H7, Section E risk status = E2).
Target: eleven dashboard JSON files in this folder, one per role, ready to paste into the dashboard Ctrl+6 overlay ("Paste dashboard JSON here").

## 1. Understand the builder
- [x] Read the Ctrl+6 overlay (`DashboardCodeOverlay.jsx`), the creation guide (`dashboardSpecCatalog.js`), the frontend catalogs (`chartCatalog.js`, `composeWidgets.js`, `kpiCatalog.js`, `boardFilters.js`, `mapFields.js`, `overTime.js`)
- [x] Read the backend contract (`util-dashboard/constants.js`, `field_catalog.js`, `sanitize.js`, `widget_validation.js`, `board_filters.js`, `pipelines.js`)
- [x] Confirm derived (hidden computed) values are stored on submissions (`submit_response.js` saves `resolved_data`)

## 2. Align `file.md` with the renumbered form
- [x] Section F questions: E1 -> F1, E3 -> F2, E7 -> F3, E8 -> F4, E9 -> F5, E10 -> F6/F7, H1/H2 -> F2.1/F2.2
- [x] Conclusion: Part F -> Part H, F1..F7 -> H1..H7
- [x] Preparedness -> Section G; Section E risk status -> E2
- [x] Mark the five structural defects as resolved / not applicable in this version

## 3. Engine gaps found (fix before building)
- [x] Hidden computed fields are invisible to the dashboard (type `hidden` is not categorical, not numeric, not offered in the guide) - needed for site confirmation status, criteria count, capacity status, overflow, total persons, household size, occupancy rate
- [x] Backend `field_catalog.js`: a hidden field with `computed.enabled` counts as categorical AND numeric ("derived")
- [x] Filter operators `empty` / `not_empty` (backend constants, match stage, validation; guide and paste normalizer) so completeness cards can be built
- [x] Backend `board_filters.js`: a derived field may be a board filter
- [x] Board filters accept `multi_select` fields (both sides) so activity type and provider can filter a board
- [x] Frontend mirrors: `chartCatalog.js`, `composeWidgets.js`, `dashboardSpecCatalog.js` (guide lists derived fields with role `derived` and their `answer_values`), `kpiCatalog.js`, `boardFilters.js`, `mapFields.js` untouched
- [x] Form JSON: declare `options` on the derived choice fields so the guide can list their values
- [x] i18n: field type badge "Derived" in en/fr/kn

## 4. Build the eleven dashboards (JSON, paste-ready)
- [x] 01 Disaster Risk Reduction / Prevention Specialist
- [x] 02 Emergency Operations Coordinator
- [x] 03 Preparedness & Evacuation Site Officer
- [x] 04 Damage & Loss Assessment / PDNA Analyst
- [x] 05 Social Affairs & Vulnerable Groups Officer
- [x] 06 Relief Logistics & Supply Chain Officer
- [x] 07 Critical Infrastructure & Public Works Engineer
- [x] 08 GIS / Spatial Risk Analyst
- [x] 09 Health, WASH & Environmental Health Focal Point
- [x] 10 M&E / DMIS Data Administrator
- [x] 11 Executive / DIDIMAC view

## 5. Verify
- [x] Every file parses, every field id exists on the form, every widget passes the backend validator (`validate_dashboard`) and the frontend normalizer
- [x] Backend syntax check (`node --check`) on changed files
- [x] Frontend build green

## 6. Document
- [x] `changes-and-creations.md`: what each dashboard shows, engine changes made, what `file.md` asked for that the engine still cannot do
