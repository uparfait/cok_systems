# DMIS role dashboards - changes and creations

Date: 2026-09-18. Form: `DMIS_Assessment_Form.json` (form group `ef2401f3-f5ab-4e0e-a02a-ec28e2e76ebd`).

Eleven paste-ready dashboards were created in this folder, one per role of `file.md` section 3. Each file is a `{ "filters": [...], "widgets": [...] }` document in the exact shape the dashboard's Ctrl+6 overlay accepts.

## 1. How to load a dashboard

1. Open the form's dashboard page and press Ctrl+6 (Cmd+6 on Mac).
2. Open the role's JSON file in this folder, copy the whole content.
3. Paste it into "Paste dashboard JSON here".
4. Choose "Replace the board" for a fresh dashboard, or "Add to the board" to merge into an existing one (a dashboard holds at most 150 widgets).

The server validates every widget against the form on save. All eleven files were run through the same server-side validator (`dc_backend/util-dashboard/widget_validation.js` + `board_filters.js`) offline: 11 files, 320 widgets, 0 errors. The backend must be restarted once for the engine changes below, otherwise widgets that read derived fields or use the `empty` / `not_empty` operators are refused.

## 2. Form changes this work depends on

Already applied earlier today (see `file.md` section 2, every defect carries a RESOLVED note):

- Emergency Response is Section F with F1..F7 (F2.1 / F2.2 for relief provided / provider); Preparedness is Section G; the Conclusion is Part H with H1..H7; Section E risk status is E2. No field id changed.
- Household caps removed (C5/C6 max 6, C9.x max 3).

Applied now so dashboards can name what the form derives:

- `single_select_243f20` (site confirmation status), `hidden_allok7` (all criteria met) and `single_select_d4d80a` (capacity status) declare `options` with their possible values, so the creation guide lists them as `answer_values` and the Field Settings can later show them.
- `hidden_7e52fd` is labelled "C7. Total household members (males + females)" and `hidden_bd326d` "Evacuation site occupancy rate (%)" (both were unlabelled).

## 3. `file.md` alignment

`file.md` was written against an earlier draft of the form. It now:

- names Section F (F1..F7), Section G and Part H where it said "Section F (labelled E)", "Preparedness module" and "Part F";
- quotes the real field ids next to every KPI it drives (F1 `single_select_2041ff`, F7 `number_9d587a`, H2 `text_3a6df3`, F2.1 `single_select_6727ff`, ...);
- marks each of the five structural defects and the D8 filter defect as RESOLVED with the evidence;
- marks the location cascade in section 6 as DONE.

## 4. Engine changes (dashboard builder)

Three capabilities `file.md` needs did not exist. They were added on both sides; nothing existing changes behaviour.

### 4.1 Derived fields are chartable

A hidden field with `computed.enabled` (a status, a count, a total the form works out) is stored with every submission (`submit_response.js` saves `resolved_data`) but the dashboard ignored type `hidden` entirely. Now such a field is a "derived" field: it counts as a choice field (group, split, legend, board filter, `eq` filters) AND as a number field (sum, avg, median, min, max, scatter axes, heat-map weight). A numeric formula on a derived label simply skips every answer, as on any text field.

- `dc_backend/util-dashboard/field_catalog.js`: `is_derived_field`, `derived_ids`, derived ids pushed into `categorical_ids` and `numeric_ids`.
- `dc_backend/util-dashboard/board_filters.js`: `can_filter_field` (choice types or derived); used by `validate_filter_defs` and by `compute_results.compute_filter_values`.
- `frontend/src/systems/dcs/util-dashboard/chartCatalog.js`: `is_derived_field`; `classify_fields` includes derived fields as categorical and numeric.
- `frontend/src/systems/dcs/util-dashboard/builder/composeWidgets.js`: `builder_fields` offers derived fields with `is_choice`, `is_numeric` and `is_derived`; type badge "Derived".
- `frontend/src/systems/dcs/util-dashboard/kpiCatalog.js`: derived fields are eligible for KPI cards, badge "Derived".
- `frontend/src/systems/dcs/util-dashboard/boardFilters.js`: `can_filter_field`, derived fields are filter candidates.
- `frontend/src/systems/dcs/util-dashboard/dashboardSpecCatalog.js` (the Ctrl+6 creation guide): derived fields are listed with role `derived`, `can_group_or_split`, `can_measure_numerically`, their `answer_values` and their `formula`; a how-to-use line explains when to chart them.
- i18n `DCS_DB_FT_DERIVED` added to en / fr / kn (keys stay level: 1722 each).

Derived fields the DMIS dashboards read: `single_select_243f20`, `hidden_allok7`, `hidden_cnt7ok`, `number_6af621`, `single_select_d4d80a`, `number_7a7b3d`, `hidden_7e52fd`, `hidden_bd326d`.

### 4.2 Filter operators `empty` and `not_empty`

A widget filter may now say "the field was not answered" / "was answered" with no value: `{ "field_id": "image_8e68f6", "operator": "empty", "value": null }`. Empty means missing, null, blank or an empty list. This is how completeness cards (missing photo, missing GPS, missing cost, "Other" left unexplained, purpose-vs-module orphans) are built.

- `dc_backend/util-dashboard/constants.js`: `FILTER_OPERATORS` + `VALUELESS_OPERATORS`.
- `dc_backend/util-dashboard/match_stage.js`: the two Mongo conditions.
- `dc_backend/util-dashboard/widget_validation.js`: no value required for these operators.
- `dashboardSpecCatalog.js`: documented in `filter_operators` and `widget_shape.filters`; the paste normalizer keeps them.

### 4.3 Multiple-select fields as board filters

`multi_select` joined `FILTER_FIELD_TYPES` on both sides (a record is kept when the picked value is among its answers). Needed to filter the EOC board by activity type and the logistics board by provider.

Note: `composeWidgets.js` was already 563 lines before this work (over the 500-line standard); it is 565 now. Splitting it is a separate clean-up.

## 5. The eleven dashboards

Every board carries District -> Sector -> Cell as cascading board filters (a chart per sector drills to cells when a sector is picked), plus the role's own filters. Every KPI card has a Lucide icon; verdict colours are consistent across boards (risk: red / amber / green / grey; response status: red / amber / green; confirmation: green / amber / grey; yes / no: green / red; purpose: one colour per module). Loss figures carry the unit RWF, rates the unit %.

| # | File | Widgets | Board filters |
|---|------|---------|---------------|
| 1 | `01-disaster-risk-reduction-specialist.json` | 22 | + hotspot category, risk status, purpose |
| 2 | `02-emergency-operations-coordinator.json` | 32 | + F1 status, F2 activity, site in use, F5 meeting, purpose |
| 3 | `03-preparedness-evacuation-site-officer.json` | 31 | + confirmation status, capacity status, site type, command post, overflow site |
| 4 | `04-damage-loss-assessment-pdna-analyst.json` | 30 | + driver, cause, damage type, tenure, purpose |
| 5 | `05-social-affairs-vulnerable-groups-officer.json` | 31 | + occupancy, details available, C10 type, relief provided, damage type |
| 6 | `06-relief-logistics-supply-chain-officer.json` | 44 | + relief provided, provider, activity, damage type |
| 7 | `07-critical-infrastructure-public-works-engineer.json` | 27 | + facility category, type, impact status, purpose |
| 8 | `08-gis-spatial-risk-analyst.json` | 23 | + village, purpose, hotspot category |
| 9 | `09-health-wash-environmental-health-focal-point.json` | 27 | + hotspot category, WASH, facility category, site in use |
| 10 | `10-me-dmis-data-administrator.json` | 33 | + purpose, C10 type, details available |
| 11 | `11-executive-didimac-view.json` | 20 | district, sector, purpose |

### 1. Disaster Risk Reduction / Prevention Specialist
Question: which parts of Kigali will fail next. KPIs: hotspots logged, by risk status (legend), high-risk count, exposed households (all / at high risk / average), by category, new this month, households with a Section E risk profile, records with quick-win activities. Visuals: hotspots per sector (world map), heat map weighted by exposed households, exposed households per hotspot type (Pareto order), risk status within category (100% stacked), treemap of types by exposure, risk per sector heat grid, new hotspots over time by risk status, exposure trend, Section E type and risk status, quick-win activities, hotspots per district by category.

### 2. Emergency Operations Coordinator
Question: what is open right now and what is it missing. KPIs: open / in progress / resolved / resolved this week, records by status, persons not reached, incidents with outstanding needs, coordination-meeting compliance (legend), unreached persons with no meeting (alert), SAR outcomes (rescued, evacuated, injured rescued, missing found, households evacuated), sites in use, average occupancy rate, sites above 90% (alert), shelter and psychosocial support. Visuals: incidents per sector map, heat map of unreached persons, status funnel, backlog over time by status, activity donut, resources deployed (bar + per-sector heat grid), status per sector, occupancy-vs-capacity scatter, WASH at sites in use, SAR conducted, rescued over time, coordination meetings per sector.

### 3. Preparedness & Evacuation Site Officer
KPIs: sites assessed, confirmed / not confirmed / not evaluated (derived status), status legend, average criteria met (of 7), command post reactivated, command posts with challenges, households and persons to host, site capacity, overflow persons, sites exceeding capacity, overflow site identified where exceeded, written agreement, disability access, water and sanitation, confirmed sites with / without a contact verification date (alert). Visuals: criteria compliance bar (one bar per criterion), criteria x sector compliance matrix, confirmation per sector (100%), status by site type, distribution of criteria met 0..7, capacity-vs-demand scatter, confirmed sites map, overflow heat map, mobilization actions, quick wins, evaluations over time by status, command post per sector.

### 4. Damage & Loss Assessment / PDNA Analyst
KPIs: total / mean / median / largest loss (RWF), deaths, injured, trauma, missing, houses damaged, damage severity and tenure legends, loss records with cost missing, deaths recorded without a photo, cause = Other with no description (verification queue). Visuals: loss by driver, by cause, by damage type, average loss per damage type (outliers), damage type per sector, loss-vs-deaths scatter, loss / injured / deaths bubble, loss over time, deaths over time, driver x cause heat grid, loss treemap by cause, other structures, damage by tenure, loss per sector map, loss heat map, most expensive cells.

### 5. Social Affairs & Vulnerable Groups Officer
KPIs: households assessed, persons affected (derived C7), average household size, males, females, the six vulnerability classes, details available, occupancy status, households in a high-risk zone, assessment type, households with no relief, disabled member and no relief (alert), households without a NID. Visuals: persons affected per sector, under-5 / over-65 / disabled / pregnant per sector, occupancy per sector, damage type x occupancy heat grid, average household size per sector, relief coverage per sector, persons affected per cell map, density heat map, persons over time, households over time by assessment type. NID and phone are never shown on a chart.

### 6. Relief Logistics & Supply Chain Officer
KPIs: households reached, coverage yes / no, persons in households reached, cash and vouchers (RWF), Other-provider distributions, providers legend, every food commodity (beans, rice, maize flour, cooking oil, sugar, salt, HEB, RTE, Shisha Kibondo) and every NFI (blankets, mattresses, nets, tarpaulins, kitchen sets, buckets, jerrycans, soap, hygiene / dignity / baby kits, clothing), roof blown off with blankets but no tarpaulin (alert), same NID assisted more than once (occurrences, possible duplicate). Visuals: distributions per provider, provider over time, providers per sector heat grid, beans / rice / cash / vouchers / blankets / tarpaulins per sector, households reached per cell map, delivery heat map, coverage per sector, cash over time, activity donut.

### 7. Critical Infrastructure & Public Works Engineer
KPIs: facilities assessed, status legend, severely damaged, destroyed, inaccessible, under repair, functional, affected units, health / WATSAN / education / energy / transport facilities, health facilities not functional (alert), unit count missing. Visuals: category x status matrix, status within category, facilities per type, type treemap nested under category, affected units per type, assessed over time by status, categories per district, status per sector, facilities per sector map, affected-unit heat map, deaths and loss per category.

### 8. GIS / Spatial Risk Analyst
KPIs: records, with / without GPS, with / without UPI, by purpose, villages and cells covered (distinct counts), parcels visited more than once, villages with 3+ records (clustering), wetland encroachment and riverbank violations. Visuals: kernel density of all records coloured by purpose, hotspot register heat map (weighted by exposure) beside the impact heat map (weighted by household members) to validate the risk register, records per cell map, records per sector by purpose map, village treemap nested under cell, geological and hydro-meteorological types, records over time by purpose (season view), GPS completeness per sector, sector x purpose heat grid.

### 9. Health, WASH & Environmental Health Focal Point
KPIs: biological and chemical hotspots, biological types legend, health and WATSAN facilities by status, sites in use, WASH availability, persons in sites lacking WASH, sites above 80% occupancy without WASH (alert), trauma, injured, psychosocial support, flooded households, waterborne outbreak zones. Visuals: biological and chemical types, health and WATSAN facility types by status, occupancy rate by WASH availability, crowding scatter, WASH per sector, epidemic-risk heat map, chemical-hazard heat map, flooded-household heat map, trauma over time, psychosocial per sector, biological / chemical hotspots per sector map.

### 10. M&E / DMIS Data Administrator
KPIs: submissions total / today / this week / this month, active assessors (distinct), by purpose, records with / without the mandatory photo, missing GPS, missing incident time, missing purpose (orphans), missing UPI, missing assessor phone, C8 = no, Other cause / Other provider unexplained, loss records missing cost, three router-vs-module orphan checks (hotspot without type, household without head, infrastructure without facility type), duplicate NIDs, duplicate UPIs. Visuals: submissions per assessor (occurrences bar), assessors submitting without photos, submissions per day control line, over time by purpose, purpose x C10 routing heat grid (the Sankey substitute), sector x purpose, missing photo / GPS per sector, C8 per sector, per district by purpose, per sector map.

### 11. Executive / DIDIMAC view
Tiles: persons affected, deaths, missing, households displaced, total estimated loss, open incidents, confirmed site capacity vs current demand, high-risk hotspots, visits by purpose, facilities not functional, households reached with relief. Below: visits per sector by purpose map, 12-month incident trend (set the board period to this year), sector league tables (loss, persons affected), visits over time by purpose, response / confirmation / risk donuts. For the partner (MINEMA / Red Cross / UN) variant share the board through a public link: it carries no personal fields, and board filters can be locked at district or sector level.

## 6. Asked for in `file.md` but not possible in this engine (and what was used instead)

- Ratios and percentages as a single number (coverage rate, kg per person, cost per household, criteria compliance %): a KPI computes one formula on one field. Substitute: the two numbers side by side, or a legend / 100% stacked chart that shows the share.
- Response latency (incident time to first response), mean days since reassessment, mean time under repair: no date-difference formula. Substitute: trends over time.
- Joins across records (recurrence within 200 m, hotspot-vs-impact overlap, duplicate distributions within 7 days, latest status per facility): widgets read one record at a time. Substitute: overlaid heat maps, occurrences of the same NID / UPI.
- Sankey, waterfall, box plot, radar, bullet, gauge, funnel, word cloud, population pyramid, network view, time-slider animation, control limits: not chart types. Substitutes: heat grids, 100% stacked bars, column funnels, scatter / bubble, over-time columns.
- Alerts, thresholds and notifications: not a widget feature. Substitute: red / amber tinted KPI cards that count the alert condition (open incidents, sites above 90%, unreached persons with no meeting, deaths without photo, stale contacts).
- Percentile filters (cost above the 95th percentile): only fixed numeric thresholds exist (`gt` / `gte`). Substitute: the largest single loss card and the average-per-damage-type lollipop.
- PII masking with audited unmask, click-to-call, photo galleries, XLSX / PDF / GeoJSON export, a data-quality badge, an auto-drafted situation paragraph: page features, not widgets. Personal fields are simply never charted; the records overlay behind a widget already lists rows.
- Date comparisons such as "incident time in the future": no date operators in widget filters.
- Season-to-date or same-period-last-year presets: the period presets are all / today / this week / this month / last month / this year / custom.

## 7. Verification

- `validate_dashboards.js` (scratch harness): sanitize -> `validate_dashboard` -> `validate_filter_defs` against the real schema, plus an unknown-field and preset-field scan. Result: 11 files, 320 widgets, 0 errors.
- `node --check` on every changed backend file: ok.
- Frontend production build (`npm run build`): exit 0, `tsc -b && vite build` green.
- The form JSON still passes the structural lint (no duplicate ids, no missing variable references, no numbering collisions).

Nothing is committed to git; the backend needs a restart.

## 8. Translation links, redesigned (2026-09-18, later the same day)

- **What can be changed**: only texts a respondent sees - field labels and heading texts, paragraph texts, option labels, placeholders, help texts, scale end labels. Validation and required messages, ids, values, conditions, formulas and design are never offered.
- **What the creator locks**: LANGUAGES, not text kinds. "Languages the translator may NOT change" = English / Kinyarwanda / French. A locked language is shown read-only on the public page and refused on save (`read_locked_languages`, `read_changes` in `dc_backend/utilities/translation_texts.js`).
- **Public page** (`/dcs-translate/:token`, no sign-in): three fields per page with Back / Next, each field drawn as the respondent sees it (a heading at its level and colours once per language, a paragraph once per language, other fields as label + input or choice list in the reader's language), then every text with English, Kinyarwanda and French stacked in full-width textareas. No field ids anywhere; the field type is named in words. Mobile: one column, 16px gutters, fixed bottom bar.
- **Saves are proposals**: `PUT /public/translate/:token` stores each changed text in `dcs_form_translation_proposals` (`models/form_translation_proposals_model.js`) with the value the form held; the form is untouched. The page shows each saved text's state (saved / applied / restored).
- **Creator review**: Form settings -> Translation links -> "Review (n)" opens the proposals of that link three fields per page with the current text beside the proposed one; Apply writes the ticked pending texts into the active version (schema re-validated, replaced text remembered), Restore puts the remembered text back, Dismiss drops pending ones. Endpoints under `/forms/:id/translation-links/:link_id/proposals[/apply|/restore|/dismiss]` (`controllers/forms/translation_proposals.js`), editors only. Deleting a link deletes its proposals.
- Proof (offline, DMIS form): a locked language is dropped, a validation message is refused, an unknown field is ignored, an unchanged text is not a proposal, apply records the previous text, restore returns the exact original schema.

## 9. Share links that open several dashboards (2026-09-18)

- **Creating or editing a link** (dashboard page -> Share links): when the form has more than one dashboard the form shows "Dashboards in this link": *Only this dashboard* or *This dashboard together with others*. Combined, the other dashboards are ticked from a list, and a dropdown "Settings for" names the dashboard whose advanced configuration (free or fixed filters, fixed period, records, own title) is being edited - every dashboard keeps its own. Another dashboard's board filters are fetched when it is first configured (`LinkDashboardsFields.jsx`; stored as `extra_dashboards: [{ dashboard_id, config }]` on the link, validated in `controllers/dashboard_links.js`).
- **Opening the link**: the public page shows a dashboard dropdown in the header when the link opens several; the choice rides in the URL (`?d=<dashboard id>`). Every data, filter-value, records and KPI request names the open dashboard, and the server applies that dashboard's own configuration (`controllers/public_dashboard.js`: `shared_entries`, `link_config(link, dashboard_id)`, `forced_filters(link, req)`); a dashboard the link does not open is refused with 404.
- Links saved before this change keep working unchanged (one dashboard, its own config).
