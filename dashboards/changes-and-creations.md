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

Every board carries District and Sector as cascading board filters plus the role's own; nothing groups by sector - maps and charts read at DISTRICT level, and picking a district in the filter bar drills them to its sectors on their own. Every KPI card has a Lucide icon; verdict colours are consistent across boards (risk: red / amber / green / grey; response status: red / amber / green; confirmation: green / amber / grey; yes / no: green / red; purpose: one colour per module). Loss figures carry the unit RWF, rates the unit %.

| # | File | Widgets | Board filters |
|---|------|---------|---------------|
| 1 | `01-disaster-risk-reduction-specialist.json` | 11 | district, sector + role filters |
| 2 | `02-emergency-operations-coordinator.json` | 12 | district, sector + role filters |
| 3 | `03-preparedness-evacuation-site-officer.json` | 11 | district, sector + role filters |
| 4 | `04-damage-loss-assessment-pdna-analyst.json` | 12 | district, sector + role filters |
| 5 | `05-social-affairs-vulnerable-groups-officer.json` | 13 | district, sector + role filters |
| 6 | `06-relief-logistics-supply-chain-officer.json` | 12 | district, sector + role filters |
| 7 | `07-critical-infrastructure-public-works-engineer.json` | 11 | district, sector + role filters |
| 8 | `08-gis-spatial-risk-analyst.json` | 11 | district, sector + role filters |
| 9 | `09-health-wash-environmental-health-focal-point.json` | 11 | district, sector + role filters |
| 10 | `10-me-dmis-data-administrator.json` | 12 | district, sector + role filters |
| 11 | `11-executive-didimac-view.json` | 11 | district, purpose |

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

## 10. Compact redesign of the eleven dashboards (2026-09-18, evening)

Each board was cut to ONE SCREEN readable in about thirty seconds: 127 widgets in all (11 to 13 per board, down from 320). The shape is the same everywhere:

- a dense KPI row of 6 to 8 cards (the alert cards tinted red / amber, the good news green);
- one map at DISTRICT level (a district picked in the filters drills to its sectors automatically) and, where the form captures GPS, one heat map weighted by what matters to the role (exposed households, persons not reached, loss, household members, affected units);
- two to four charts that show where things stand (100% stacked bars, donuts, one trend over time), never a table, a league list or a per-sector breakdown.

The role descriptions in section 5 still name the questions each board answers; the per-sector breakdowns, occurrence lists and secondary charts they mention were removed from the files. The earlier 320-widget versions are gone; regenerate them from the git history if a deep-dive board is ever wanted again.

## 11. Report-style boards: engine additions and the disaster folder (2026-09-25)

The seven boards of `../dmis_dash.html` (the City of Kigali disaster dashboards) were rebuilt for the DMIS form in `disaster/` (one JSON per board, `README.md` beside them). Four things those boards need did not exist in the engine and were added on both sides. Nothing existing changes behaviour; the backend needs one restart.

### 11.1 A widget's own fixed date - `period.locked`

A widget's `period` may carry `locked: true`. The board's date filter then passes it by: it always reads its own window (`match_stage.effective_bounds`, `is_period_locked`), and the card wears a "Fixed: <window>" chip. Set from the card menu -> "Date & filters", from the same step in every composer, or in pasted JSON. `sanitize_extras.sanitize_period` keeps the flag only when it is a real `true`.

### 11.2 Pinned fields - `pinned_fields`

A widget may list board filter fields it refuses to follow (at most 10, each a field that can filter the board). A board filter on a pinned field - and on any field below it in a cascade, since a sector already names a district - is not applied to that widget: no drill-down, no narrowing, no board context (`board_filters.ignored_filter_ids`, `descendant_field_ids`). Every other board filter still applies. This is what keeps a row of one card per district whole while the rest of the board drills into the picked district. The card wears an "Ignores filter: <fields>" chip. Same dialog and composer step as the date.

### 11.3 Text blocks - `chart_type: "text"`

Words on the board: `text: { heading, body, align, size, accent }`. The body's blank lines are paragraphs, `**bold**` is bold and `==highlight==` takes the accent colour (the widget's number colour unless `accent` names one). A text block reads no data (`compute_widget_data` returns `{ kind: "text" }`, the frontend never fetches it), its title is optional like a canvas's, and it is painted from its own appearance - so a title band is a text block with a dark background, size `lg`, centred, heading only. Builder tab "Text" (`builder/TextComposer.jsx`, `textCompose.js`), right-click -> "Add a text block here", card `charts/TextWidget.jsx`. Limits: heading 200, body 4000 characters.

### 11.4 Tables - `chart_type: "table"`

`table.mode` is `records` or `summary` (`util-dashboard/table_data.js`).

- RECORDS: the submissions themselves under the widget's filters, the board's filters and the period; `table.fields` (1-30) are the columns, `table.page_size` is held between 10 and 100 (default 10), `table.sort` is `{ field_id | "submitted_at", direction }`, `show_submitted_at` puts the date first. Paging asks the board for that one card again with `table.page` on the request (`useBoardData.page_widget`); the viewer may also change the rows per page on the card, and nothing about paging is ever saved. On a tracked form a row is a stage and is sorted by the moment it opened.
- SUMMARY: one row per value of `group_by`. Columns come from `split_by` (every value a column, each cell the widget's `metric`) OR from `table.columns` - measures `{ key, label, aggregation, field_id, filters }`, each its own formula (count, count_distinct, sum, avg, min, max, stddev - never median, running or moving figures, never occurrences) on its own field under its own filters, so "Annex" is a count filtered on one value of a multi-select while "Deaths" beside it is a sum. Never both. `table.totals: { row, column }`: a Total row (default on) and a Total column (default off). Totals add up from the cells on show when every column counts or sums; for averages and extremes the total row is computed again over the rows on show and there is no total column. `widget.limit` (1-50) caps the rows, `widget.sort` orders them by row total or by name. A click on a row (or a cell of a split table) opens its records like a bar of a chart. The data key is `table_totals`, apart from the dimension totals every widget carries under its legend.

Builder tab "Table" (`builder/TableComposer.jsx`, `TableColumnsEditor.jsx`, `TableFieldsPicker.jsx`, `tableCompose.js`), card `charts/TableWidget.jsx` (sticky header and first column, totals row, Previous / Next and rows-per-page on the card). Validation in `util-dashboard/validate_extras.js`; sanitizing in `sanitize_extras.js`; vocabulary in `constants.js` (`TABLE_MODES`, `TABLE_LIMITS`, `TEXT_LIMITS`, `MAX_PINNED_FIELDS`).

### 11.5 Also fixed on the way

- A widget INSIDE A CANVAS was refused with "the canvas it sits in is not on this dashboard" whenever its data was fetched, because every data request validates one widget at a time and the nesting check could not find its parent. Nesting is now checked at save time only (`validate_dashboard(..., { nesting: false })` in `compute_results.js` and `widget_records.js`). Every card inside a section computes again.
- The Ctrl+6 creation guide documents `text`, `table`, `pinned_fields` and `period.locked`, and the paste normalizer keeps them and checks every field id they name. The guide's chart and key texts moved to `dashboardSpecShape.js`.
- Chips, the "Date & filters" dialog (`WidgetBehaviorDialog.jsx`) and the composer step (`builder/WidgetBehaviorStep.jsx`, `PeriodSettings.jsx`, `PinnedFieldsSettings.jsx`, `widgetBehavior.js`). i18n: 100 keys added to en / fr / kn (2216 each).

### 11.5b Fixed after the adversarial review (same day)

Four reviewers and six skeptics went over the whole change set. What they confirmed, and what was done:

- The public share-link data endpoint computed a RECORDS table like any widget, so a link with `allow_records: false` (or a field whitelist) would have shipped the rows anyway. `compute_dashboard_results` now takes a records policy from the link (`get_public_dashboard_data`): a forbidden table comes back locked and empty (the card says so), a whitelisted one cut down to the allowed fields. Signed-in viewers see everything, as before.
- A PIN could lift a share link's LOCKED filter (the link forces District = Gasabo; a widget pinned on district would have shown every district). Forced filter ids are now passed to `apply_board_filters` and are never ignored.
- A viewer's table PAGE was kept across filter and period changes, which could land on a page past the end (an empty table). The board starts every table at page one on a new selection (rows per page is kept), the page is only applied while the table is set up as it was when the page was turned, and the server clamps a page past the end to the last one.
- A summary table's `$facet` had no bound on the number of group values; the rows on show are now resolved first (the most frequent values, capped by `widget.limit`) and every facet reads those only. Split columns beyond the cap fold into an Other column when the formula adds up, and the table says when they could not be folded.
- `occurrences` as the cell formula of a split table passed validation; refused now, like the KPI-only formulas.
- A split table whose split fell away (a board drill landed the group field on it) came back empty; it now degrades to one column of its own formula.
- A click on a MEASURE cell of a summary table opened the whole row's records (a measure has filters a click cannot carry); only rows - and the cells of a split table - open records now.
- Reconfiguring a widget rebuilt it WITHOUT its canvas, its box, its over-time reading or its fixed filters, so a note edited inside a panel fell out onto the board (this predates today for filters, but the new Text and Table tabs route editing through it). The builder now keeps those from the original; a reopened KPI also lands on its formula (`widget_to_spec` names `formula_id`), and a reopened table keeps its filters.
- The composers let a CUSTOM window with no start date through (the server then refused the whole save); every composer's Add button now stops on it, and a table column filter under `gt` / `gte` / `lt` / `lte` must be a number.
- The new i18n strings used `{var}` where the translator substitutes `{{var}}`; fixed in all three languages.
- A stacked bar's CATEGORY AXIS ignored `appearance.value_labels` (legends and KPI legends honoured it), so board 2 would have read `roof_blown_off_d` instead of Roof. Category axes and tooltips now write the renamed label; the rows keep their stored values, so clicks still open the right records.
- Boards: facility and hotspot types now read as the form's own option labels; board 6 draws its four risk tiles in a two-by-two grid beside the note, as the HTML does; board 3 has no total card, as the HTML has none.
- An empty records table is no longer hidden by the board filters (it shows its own empty row); a pin on a field the public page cannot name draws no chip.

### 11.6 Verification

- `dc_backend/tests/dashboard_features.test.js` (mongodb-memory-server): locked period, pinned fields end to end through `compute_dashboard_results`, records table paging and clamping, summary tables with measure and split columns and their totals, a widget inside a canvas computing alone, text blocks, and the validator's refusals - `ALL_TESTS_PASSED`, with the six earlier suites still green (`disaster/logs/backend_tests.log`).
- `disaster/validate_boards.js`: 7 boards, 68 widgets, 0 errors (`disaster/logs/validate_boards.log`).
- `disaster/compute_boards.js`: every widget of every board computed against 240 seeded DMIS-shaped submissions under three scenarios (`disaster/logs/compute_boards.log`).
- Frontend `npx tsc --noEmit` and `npx vite build` (`disaster/logs/frontend_build.log`).

Known limits: the observation texts of the boards are the HTML's own words and do not recompute (a text block is static by design); the district cards say the district's name and its count, where the HTML put the number under the name; `composeWidgets.js` is now 575 lines (it was already over the 500-line standard before this work - splitting it is a separate clean-up). Nothing is committed to git.

### 11.7 Follow-ups asked for after the first review (same day)

- **Table headers on dark cards**: the header row and the total row of a table widget were painted with the theme's light grey, so on a dark card they read white on white. They are now a light tint of the widget's own text colour laid over its own surface (`--table-head`), readable on any card colour.
- **No "Ignores filter" chip**: which board filters a widget ignores is the author's setting (Date & filters) and is no longer written on the card. The "Fixed: <window>" chip stays.
- **A share link may fix the colour mode** ("Colour mode for viewers" in a link's advanced configuration: viewers choose / always light / always dark - `config.theme`). The public page is pinned to it (`BoardThemeProvider fixed`), the light/dark switch disappears from its Actions menu, and the links list shows a "Dark only" / "Light only" chip. Stored per dashboard configuration like the other options; the open dashboard's setting applies.
- **Several dashboards at once**: "Select" in the dashboard switcher turns every row into a tick box; the foot then offers "Make names uppercase" (each ticked dashboard renamed to its own name in capitals) and "Delete selected" (after one confirmation; the first dashboard left takes over when the open one went, and an empty form asks for a new name). `useDashboards.uppercase_many` / `remove_many` call the existing rename and delete endpoints one by one.

### 11.8 Live figures in text blocks (same day)

A note that says "Fire incidents (5 deaths)..." with a typed 5 is stale the day after. A text block's body may now carry FIGURES the server computes every time the block is read, under the block's own filters, the board's filters and the period - like every other widget:

- `{{count}}` records in scope; `{{count(field)}}` records that answered a field; `{{count(field = value)}}` records holding a value;
- `{{sum(field)}}`, `{{avg(field)}}`, `{{min(field)}}`, `{{max(field)}}`, `{{count_distinct(field)}}`;
- `{{share(field = value)}}` the percent of the records in scope holding that value (shown with a % sign);
- any of them narrowed with a condition after a vertical bar: `{{sum(number_271ca1 | single_select_7c5216 = rain_wind)}}` is the injuries from rain-and-wind events.

Backend: `util-dashboard/text_data.js` parses the body (`parse_text_variables`, at most 20 different figures, deduplicated) and computes every figure in ONE `$facet` round trip over `base_stages`; a block without figures costs no query. `validate_extras.validate_text` refuses an unknown formula, a malformed token, a share without a value, and a field the form does not have - on save and on paste. The data is `{ kind: "text", values: { "<token>": number } }`.

Frontend: `util-dashboard/textVariables.js` (the grammar's frontend half: `has_text_variables`, `variable_token`, `substitute_variables`), `TextWidget` substitutes the figures (each reads "..." until they land), `useBoardData.reads_data` fetches only text blocks that carry figures, and the data signature includes the body. The Text tab has a "Live figures" helper (`builder/TextVariableInsert.jsx`: formula, field, optional value, optional condition -> Insert at the cursor, the token shown before it is inserted) and a "Preview with real data" button that computes the block once through the data endpoint. The Ctrl+6 guide documents the grammar.

Boards: every observation note of the disaster boards now computes its numbers (`build_boards.js`), carries its module as its own filter (household loss, infrastructure, hotspot) and, where it names districts or risk levels, is pinned on those fields. The board NAMES lost their numbers ("Hotspot identification and monitoring - assets", not "7. Hotspot ...") while the file names keep theirs (`01-` to `07-`) so the folder stays in the HTML's order; the checks read every `.json` in the folder and the computation log prints each note's figures.

### 11.9 Confirmations above menus (same day)

The generic confirm dialog (`components/DcsConfirmDialog.jsx`) was drawn at z-index 10000 inside whatever asked for it, while the dashboard switcher and every other popover menu sit at 10060 - so "Delete the selected dashboards?" opened BEHIND the list it was asked from. The dialog is now portalled to the document body at 10070, above every menu, for every confirmation in the system.

- Deleting the ticked dashboards did nothing: the popover closes on any mousedown outside itself, the confirmation (drawn outside it) counted as outside, and the ticked ids were cleared before the delete ran. The list now stays open while a confirmation is up or work is running, the ids are taken the moment Delete is pressed, and a spinner shows while names are changed or dashboards deleted. "Done" leaves the select mode without closing the list.
