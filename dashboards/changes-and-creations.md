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

### 11.10 Boards flattened: no canvases, white cards (2026-09-27)

The seven disaster boards no longer use canvases or the HTML's dark blue panels. `build_boards.js` now emits plain widgets on the ordinary grid with the default white card: title bands as full-row text blocks, the district cards and risk tiles in the board's own KPI row (named for what they count, e.g. "Gasabo - households", since board 1's household and facility cards now share that row), tables and trend lines a row each, bars and notes half a row each. The HTML's hazard and risk colours survive only as series colours on the bars and as the number colour of a risk tile; the notes' highlights use the system blue. 59 widgets in all (down from 68: the panels are gone). The canvas and box features themselves stay in the engine for boards that want them.

### 11.11 Cascade drill and the stacked-value title (2026-09-27)

- **A card says the value it is stacked on.** A widget that ignores a board filter and carries its own value for that field (district = Gasabo) always names that value: when the author's title already says so ("Gasabo - households") it is left alone, and when the author renamed the card to something that does not ("Deaths") the value is added in brackets - "Deaths (Gasabo)". `util-dashboard/cascade.js` (`shown_title`, `stacked_values`); the stored title is untouched.
- **Two ways down from a card.** Every card whose field has a level below it in a cascade (district -> sector -> cell -> village) shows, on hover, a two-part bar: left "Click to view the table" (the records behind it), right "Click to view Sectors" - an overlay holding the same card regrouped by the child level, computed under the board's own period and filters. A grouped chart regroups; a card fixed on one value (Gasabo) opens a bar chart of that value's children only; a map is drawn as bars one level down; a split that would land on the child falls away. The overlay's card carries the same bar, so the levels open one on top of another until the chain's last level, which offers the table only. Escape steps back, the cross closes everything. On phones and tablets (no hover, coarse pointer, or up to 1024px) the bar is always shown and the panels fill the screen. `util-dashboard/cascade.js` (`drill_target`, `derive_child_widget`), `DrillOverlay.jsx` (`useDrillStack`), the bar in `WidgetCard.jsx`; wired on the signed-in page and the public page (the server now sends the form's cascade chains as `cascade_fields` so the public page can go below the board's filter fields).
- Verified with the frontend build; no board file changed.

### 11.12 Runtime fix: card crashed on render (2026-09-27)

The production bundle threw "ReferenceError: Cannot access ... before initialization" as soon as a board drew a card: the new title line in `WidgetCard.jsx` read the card's palette a few lines above the `const` that declares it - a temporal dead zone the type-check does not catch. The line now follows the declaration. An import-cycle scan of the whole DCS frontend (404 files) found no cycle among the dashboard modules; the one loop it found (form renderer <-> group/section fields) predates this work and is unrelated.

### 11.13 Widgets no longer name their form (2026-09-27)

Every widget of the seven board files carried `form_group_id`, the DMIS form's id - a value an external assistant writing a board from the creation guide cannot know. It was never needed: the board is pasted on the form's own dashboard page, and the server already writes the form onto every widget on save (`save_dashboard.js`) and at data time (`compute_results.js`); the paste normaliser (`normalize_pasted_widgets`) likewise stamps the current form and ignores whatever the pasted widget said. So:

- `build_boards.js` writes no `form_group_id`; the seven JSON files were regenerated and hold field ids only. `validate_boards.js` and `compute_boards.js` stamp the form themselves, as the server does.
- The creation guide (Ctrl+6 -> copy the creation rules) no longer lists the form's id under `form`, its examples carry none, and a new rule says a widget never names its form, its name or its project, and that any such key in a pasted widget is dropped.
- Copying widgets out of the overlay strips `form_group_id`, so JSON shared between forms or handed to an assistant is form-free.
- The guide's report-style rule now recommends plain widgets in reading order; a canvas is mentioned as possible, not asked for.

Nothing changes for widgets built in the app: the composers still stamp the form on their drafts, and the server keeps refusing a widget whose form does not belong to the project.

### 11.14 Maps: "The boundaries could not be loaded" in a fresh browser, and the whole level drawn (2026-09-28)

**What was wrong.** A map widget only declared itself ready on MapLibre's `load` event, which fires once the remote basemap (style, sprite, fonts and the first tiles from tiles.openfreemap.org) has fully arrived and been drawn. The card gives the map engine 20 seconds before it calls it broken and shows the generic veil, whose default text is the boundaries message. In a browser with nothing cached yet, the basemap regularly took longer than that, so every fresh browser saw "The boundaries could not be loaded" - while the boundaries themselves, served by our own backend in about 6 ms, were never the problem. A browser that had the basemap cached from earlier never hit it, which is why it looked like a new-browser problem.

**The fix.**

- `mapKeeper.js` tells the card the map is ready on `style.load` (the moment the style is parsed and the widget's own layers can be added) or on `load`, whichever comes first. The boundaries draw at once over the widget's background; the basemap fills in behind them as it arrives, or never, when it cannot be reached (the style fetch already fell back to a plain background after 8 seconds).
- A map engine that really cannot start (no WebGL, a blocked worker) now says so: `DCS_DB_MAP_ENGINE_FAILED` in the three languages, instead of blaming the boundaries. A boundaries request that does fail shows the server's own reason after the message.
- `useBoundaries.js` keeps the board scope it last answered for and asks again when the filters change (a card with no data at all shows "No data" before any map, like every widget).

**All boundaries shown.** The server (`map_shapes.js`) now returns `context`: every other place of the drawn level under the board's filters, so a district map shows all three districts with the unanswered ones pale, a sector map every sector of the filtered district, and a cell map every cell. A level too large to draw whole (the 1,162 villages of the city, or the 485 of a district) sends no context and only the named places are drawn; inside one cell the villages are few and all are drawn. The card frames the whole level and names every place; pale places have no marker and their tip reads "No records". Context always travels (it follows the filters, not the names), while shapes the widget already holds still do not travel twice.

**Found by the adversarial review (10 agents) and fixed the same day.** The HTTP controller never forwarded `have` / `have_level`, so over the API the widget's held shapes always travelled again; it now forwards them and `have_context`, and the server answers `context: null` when the widget says it already holds the rest of the level for these filters. A drawn place could satisfy a filter by carrying the same name (the cells of the sector Kigarama brought along a cell called Kigarama from another district): a filter must now be passed above the drawn level, and a widget naming places outside the filtered branch (a pinned row of district cards under a district filter) is answered by the open walk whenever that answers more of its names - before, such a card drew the filtered district alone. One place name coming from two unrelated filter fields was read as two chain steps and widened the map to the whole city: `mapScope.filter_names` now keeps a repeated name only when its fields are steps of one cascade. Three retry races in `mapKeeper.js` / `MapChart.jsx`: a map dropped while its style was still being fetched could later tell the new card it was ready (the new map then never got its layers), the studio copy's Retry dropped the live board's shared map, and the 20-second watchdog was never cleared when a slow map did come up (a background tab ended on the WebGL veil). Dropped entries now stay silent, a stale entry never unregisters its successor, a card only listens to the entry it holds and clears the watchdog when its map comes up.

**A parent walk bug found by the new test.** The walk that narrows the tree to the filtered places kept the parent names in a set, so a cell named like its sector (Kimihurura in Kimihurura, Gasabo) counted as one step and opened the whole sector. `real_parents` and `drill` now keep repeats: a name given twice must be passed twice.

**Proof.** `dc_backend/tests/map_shapes.test.js` (no database) loads the real Kigali tree and asserts it is whole (1 province, 3 districts, 35 sectors, 161 cells, 1,162 villages, no place without an outline), finds all 1,361 places by name under their own parents in 200 requests with nothing from another branch, checks the context at every level and its cap, the kept-shapes rule, the consonant match and the unknown report, and times 100 district requests. Output in `dashboards/disaster/logs/map_shapes_test.log`. The browser-level proof (a real Chromium with WebGL, the basemap made to hang) is in `dashboards/disaster/logs/map_proof.log` with its screenshots.

### 11.15 The map background itself, on a slow link (2026-09-28)

With the boundaries no longer waiting for the basemap, a slow or unreachable basemap showed as bare ground under the boundaries and their labels, with nothing to say why. Two things caused that: the basemap style (from tiles.openfreemap.org) was fetched with an 8-second limit and, once that passed, the map kept a plain ground for good; and the vector tiles behind the style take long on a thin link with nothing cached.

Now (`charts/basemap.js`, `mapKeeper.js`, `MapChrome.jsx`):

- The map is built at once on a plain ground - or on the basemap this browser already holds - and the basemap is fetched beside it with a 45-second limit, one fetch shared by every map on the page, retried on its own on a widening schedule (5 s, 15 s, 30 s, 1 min, 2 min) and then left to the viewer. When it comes it is slid under the widget's layers with MapLibre's `setStyle` and a `transformStyle` that carries the widget's sources (with their data) and layers over, under the basemap's first labels.
- A style that came once is kept in the browser (`localStorage`, key `dcs_basemap_style_v1`) so the next page starts on it and only the tiles are still to come; the kept copy is refreshed behind.
- A small note in the corner of the map says "Map background loading..." until the basemap's tiles have filled the ground (the map's `idle`), and "Map background unavailable - click to retry" when the fetch gave up or the ground stayed bare for 90 seconds; the click fetches or re-applies the basemap. The note is in the three languages and never covers the boundaries, which draw regardless.
- `points_box` and `lightness` moved from `MapChart.jsx` to `mapGeometry.js` to keep the chart under 500 lines.

What this cannot do: make tiles arrive when the browser cannot reach tiles.openfreemap.org at all (a blocked network); the note then says so. Serving the basemap through the backend with a cache would be the next step if that turns out to be the case.

### 11.16 KPI card sizes, rows that fill themselves, and a board's own colours (2026-09-29)

**Four sizes for a KPI card.** A card is one number, so it now claims far less of a row than a chart and has a step below small. On a wide screen a row holds twelve **xs** cards, six **small**, four **medium** or three **large** (`KPI_PER_ROW` in `dc_backend/util-dashboard/constants.js` and `frontend/.../util-dashboard/boardRows.js`); narrow screens hold fewer of each, because twelve columns across a phone is twelve columns of nothing. The size is picked from the card's own three-dots menu, which now offers the four tiers with a note saying how many of them a row then holds. `"xs"` was added to the sizes the server accepts, so a pasted board may ask for it too, and the Ctrl+6 creation guide documents the four tiers for whoever writes a board outside the app.

**The card's contents scale to the card.** `kpi_density` (in `charts/density.js`) reads the width the card ENDED UP WITH and sizes everything from it: the big number, the title, the description, the legend rows and the card's own padding. Below about 130 pixels the icon is dropped rather than shrunk into a smudge, because a card that narrow has room for an icon or a figure but not both. Nothing here ever grows a card - the width decides and the contents follow, so a card made xs writes a smaller number instead of spilling out of itself.

**No gap at the end of a row.** The board is now ONE flowing grid rather than a dense KPI row above a chart grid. Every widget claims the share of a row its size asks for, takes a new row only when it genuinely does not fit in what is left of the current one, and whatever a row ends up holding widens EVENLY to fill it. So ten xs cards where twelve would fit are ten slightly wider cards, not ten cards and a hole; and because cards and charts flow together, two small cards and a medium chart share one row while twelve xs cards keep it to themselves. KPI cards still come first, so a board's figures still gather at its top. A board holding a single CHART still gives it the whole row.

**A board's own colours.** A dashboard now carries two colours of its own, saved with the board: a BACKGROUND, painted on the page and on every widget so the board reads as one surface, and the WIDGETS' BORDER, which is what still separates one card from the next once they share a background. The words are coloured automatically - dark on a pale board, pale on a dark one, through the `readable_on` rule that already kept charts legible - and so are the muted labels, the chart grids, the empty areas and the hover tints, each the background moved a measured distance towards the text colour. The border and the text colour may each be set by hand and each be put back to automatic on its own; the whole board can be put back to the system's own look. A background dark enough also switches the widgets to their dark colour set, and the page's light/dark toggle steps aside - what the author chose is what the board looks like.

Set in the board's Actions menu -> "Board colours": the two pickers, a live preview drawn with the real resolved colours, "paint every dashboard of this form the same way" (one write across the form's boards) and "back to the usual colours". Stored as `appearance: { background, border, text }` on the dashboard document, sanitized to hex (`sanitize_board_appearance`); a board with no background is not a coloured board, so a stray border alone is refused. Saved through `PUT /dcs/api/forms/{form}/dashboards/{id}/appearance` with `apply_to_all`, which touches only the colours - never the widgets, the filters or the arrangement. Shared links carry the colours, so a shared board looks like the board it was shared from.

**A widget keeps its own colours.** Setting a widget's background or border in its own colour settings still wins over the board's, in either mode, because the choice was deliberate; everything the widget did not set follows the board. The widget's colour dialog now shows the truth about that: a colour still on the system default is shown as the board's, marked automatic, its preview is drawn with the board's colours, and resetting a colour hands the widget back to the board.

**Proof.** `dc_backend/tests/board_appearance.test.js` (mongodb-memory-server): only a real background makes a coloured board, hex only, trimmed and lowercased; the colours save on one board without touching its widgets, filters, arrangement or the form's other boards; `apply_to_all` paints every board of the form in one write and another form's boards are left alone; null puts a board back; a KPI card may be any of the four tiers and an unknown size is still refused. Output in `dashboards/disaster/logs/board_appearance_test.log`. The row packing itself is measured in a real browser - see `logs/board_proof.log` and its screenshots.

### 11.17 Seven fixes to how a board reads and behaves (2026-09-29)

**The hover bar carries its whole label.** The two-part bar at the foot of a card ("Click to view the table" / "Click to view Sectors") was one line with an ellipsis, so on anything narrower than a medium card it read "CL...". It now wraps instead of clipping: each half is `flex: 1 1 112px` in a wrapping bar, so on a card too narrow for two halves side by side they take a line each at full card width, and the card passes a font size measured from its own width (11px, 10px or 9px). Nothing is ever cut, at any width, and each half still opens what it always did - the records overlay on the left, the level below as an overlay on the right.

Measuring the smallest card there is - twelve to a row, about 90px wide and 70px tall - showed the other half of the problem: at 9px, capitals plus letter spacing need three lines per half, so the bar came out 81px tall on a 69px card, grew past the card's top edge and had its first line cut off there instead. On that band the bar now goes TIGHT: mixed case (a sixth narrower than capitals), no letter spacing and less padding, which brings the whole label into two lines. And the bar is held to `max-height: 100%` with a scroll of its own, so however long a cascade field's name is, the bar can never reach past the card and lose a line.

**The cascade overlay stays inside the screen, at one width.** Each panel used to be inset from the left AND the right by 18px per level, so a cascade five deep shrank towards the middle of the screen. Every panel is now the same width as the one it came from - only the top edge steps down, which is what shows the depth - and the panel and the overlay are held to the screen with `box-sizing: border-box`, `max-width/max-height: 100%` and `overflow: hidden`, with `min-width: 0` on the card inside so a wide table scrolls in the body instead of pushing the panel open.

Measuring that found a second cause of the overflow, and the more interesting one: a drill panel is also a BOARD (it carries `dcs-board-root` so the card inside paints itself the same way), and a board is `width: 100%; min-height: 70vh`. On an absolutely positioned box a stated width over-constrains it - the browser honours `left` and ignores `right` - so every panel came out the full width of the screen and hung its own 16px gutter, blue border and all, past the right edge. The panels are now sized by their four edges (`width: auto`, `min-height: 0`, scoped inside the overlay so it beats the board rule), which puts them at 1368px on a 1400px screen with 16px of gutter on both sides.

**"Show more" shows more.** The card's chart area was `overflowY: hidden`, so a chart opened out to all of its values - or a legend of three hundred entries - was drawn taller than the card and simply clipped, with no way to reach the rest. That is why the link looked like it had done nothing. The area is now scrollable in both directions and carries `min-h-0`, so everything a widget holds is reachable by scrolling INSIDE the card rather than pushing the card past its row or spilling over the page.

**No "fill the screen" on a phone or a tablet.** `ExpandableSlot` no longer renders its corner button when `(hover: none), (pointer: coarse), (max-width: 1024px)` holds. A card on a small screen is already nearly the width of it, and a control that only appears on hover has no business on a screen with nothing to hover with, where it sat permanently over the card's corner.

Nor on the SMALLEST CARD, for the same reason at a different scale: an xs card is about 90px across and 70px tall, the hover bar takes four fifths of it, and the expand button then sat over the bar's first line and hid the word "Click". Two hover controls do not fit on one of these, so the one that matters there - the bar that opens the records and the level below - keeps the card to itself (`claims_little` in `boardRows.js`). The card's own three-dots menu, at the other corner, is unaffected.

**The card's four sizes are in the KPI settings too.** The KPI tab now carries the same four tiers as the card's own menu (xs, small, medium, large) with a line saying what each means in practice, and every card the tab builds - including one card per value of an "in each" field - is built at the chosen size. The chart, map and table tabs already had their three.

**Board colours: this board, or every board of the form.** The Actions menu entry opens the colour settings, and the scope is now an explicit choice of two - "This dashboard only" or "Every dashboard of this form" - rather than a switch to notice.

**A widget's own colours survive dark mode.** A colour set on a widget is a decision about that card, not a preference of the mode it happened to be set in. `build_palette` now applies any colour stored under the widget's `light` or `dark` set to whichever set is in use, so a card given its own background keeps it when the page is switched to dark, when the board is painted in its own colours, and when both; only what was never set follows the mode or the board. Its words still go through `readable_on`, so a pale custom card gets dark text on a dark page rather than white-on-white.

**Text blocks have their settings and their delete.** A text block carries its words inside itself, so it usually has no card title - and the card's title bar, which is where the three-dots menu lives, was only drawn when there was a title. A block therefore had no menu at all. The bar is now drawn on a text block and on a canvas WHILE THE BOARD IS EDITABLE, so its size, its colour settings, its words ("Reconfigure"), its date and filters and its removal are all one click away; a reader still sees only the words. "Date & filters" is now offered on a text block as well, because a block's live figures read filters and a period like any widget.

**Proof.** Measured in a real browser, in the same harness as the row packing - see `dashboards/disaster/logs/board_proof.log` and its screenshots.

### 11.18 One menu per widget, nothing on hover, and words that fit (2026-09-29)

**A card has no hover controls at all.** The two-part bar at its foot and the corner button that filled the screen are both gone. Everything a widget can do now lives in ONE menu, opened by a right click - or by a DOUBLE CLICK, which is how a screen with no right button asks for the same thing:

- the table of records behind the whole widget,
- the level below it in a cascade, named ("View Sectors"),
- filling the screen, and leaving it again,
- and, for whoever may edit the board, its size, what it can be turned into, its colours, its icon, its words, its date and filters, and its removal.

The viewing actions are offered to ANY viewer, not only an editor: the menu is the only way in now, so it opens for a reader too. A click on a bar, a slice, a point, a cell or a legend entry still opens that one thing's records, because that is a deliberate click on a mark rather than a control hiding until the pointer arrives. On a map the two clicks belong to the map, so there the menu is reached by a long press, which a browser reports as a context menu.

The cascade overlay carries the same two actions as buttons in its own header, beside Back, since its cards have no bar either.

**A text block's words scale to the card.** A block in a narrow card, or one carrying far more words than a card that size can hold, is drawn smaller rather than spilling over the card or being cut off by it: the size falls with the card's measured width (to 60% of what was asked for below 150px) and again with the sheer length of the body (to 70% past four thousand characters), with a floor of 8px past which the card's own area scrolls. So a title band in a twelfth of a row still reads as a title band, and a page of text in a small card is a small page of text.

**"Back to the usual colours" is never covered.** In both colour dialogs that line now takes a row of its own above the buttons on a narrow dialog instead of being squeezed behind them.

Also gone with the hover controls: the description placeholder that appeared on a card while it was hovered, and the rule that forced the corner button visible on touch screens.

**A bug the measuring found, in the menu itself.** `BoardContextMenu` closed on any scroll event. Putting the menu into a long page makes the browser fire a scroll of its own - scroll anchoring, holding what you were looking at still while the document grows - without the page moving a pixel, so on a board long enough to be scrolled near its end the menu opened and shut itself in the same frame and never appeared at all. It now remembers where the page was when it opened and closes only on a scroll that really moved it. Since the menu is the only way into a widget's actions now, that would have left a long dashboard with no way in at all.

A non-KPI widget asked for the twelve-to-a-row size (only a pasted board can ask) now takes the smallest share a drawing is given, a third of a row, rather than falling through to half of it.

### 11.19 Every deployment starts from nothing (2026-09-29)

`update-deploy.sh` - and therefore both buttons on the Deployment Management page, which ask the host agent to run that same script - now clears everything a deployment used to carry over:

- the images are built with **no cache** and a **fresh pull** of their base images;
- every container is **recreated**, with the anonymous volumes inside it thrown away, so each reads the `.env` files just put in place. A container keeps the environment it was created with, so a plain `up -d` could run new code with the old `.env` - and the frontend bakes its `.env` INTO its bundle while it builds, so a cached layer there used to keep the previous API addresses.
- afterwards the images nothing points at any more and the builder's own cache are dropped, which is what keeps a server from filling its disk (a full disk is what stops mongo from starting at all).

The build runs BEFORE the swap, deliberately: the old containers keep serving the site - and the page that asked for the deployment - while the new images are built, so the only downtime is the few seconds of the swap rather than the whole build.

**MONGO AND EVERY NAMED VOLUME ARE LEFT ALONE.** The databases, the uploaded files and the certificates are data, not cache; only the service containers, their images and the build cache are cleared. Two new options: `--keep-cache` for the old, faster behaviour (a quick iteration, never a release) and `--fresh-env` to throw a stack's stored `.env` files away and start them again from the ones uploaded into the folder.

**The mail account every backend sends from** is now written into all three `.env` files of every stack on every deployment: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` and `EMAIL_FROM`, which is exactly what the three backends read. The values come from `deploy/env/shared.env` - git-ignored, one copy per server, because a mail password does not belong in a repository that is pushed to GitHub - or, failing that, from an `x-email` block of `docker-compose.yml`, which is where the mongo credentials already live. A key nobody provides is not written, so whatever a stack's `.env` already held is kept, and the run is repeatable: a second run changes nothing.

**Proof.** `bash update-deploy.sh --uat-ikaze --dry-run` prints the exact commands (`build --no-cache --pull`, then `up -d --force-recreate --renew-anon-volumes`, with mongo only ever `--no-recreate`). The env writing was exercised against a sandbox copy of a stack's store: all five mail keys land in `backend.env`, `em_backend.env` and `dc_backend.env`, an existing `EMAIL_HOST` is replaced rather than duplicated (the old line kept as a comment), `JWT_SECRET` and the mongo lines survive untouched, and a second run reports no further changes.

### 11.20 Why no email was being sent, in all three backends (2026-09-29)

**The cause, in one value.** `backend/utilities/email.js` built its transporter with `secure: true` on port 587. Port 587 is the submission port: it answers in plain text and STARTTLS upgrades the connection afterwards. `secure: true` makes nodemailer open a TLS handshake against it from the first byte, the handshake fails, and every message the main backend tries to send throws before it reaches the server. The comment directly above that line already said secure must be false for 587 and that true belongs to port 465, and both other backends used `false` against the same server - so the value contradicted its own documentation and its two siblings. Measured against the real server: `secure: true` fails in 4.3 s with `ESOCKET` and OpenSSL's "wrong version number"; `secure: false` connects and the credentials are accepted in 2.7 s.

**Why nobody saw it.** The failure was swallowed twice. `sendEmail` catches, logs "SMTP Error" and answers `{ success: false }` - it never throws - and `request_reset.js` ignored the answer, wrote "Password reset OTP sent to..." into the audit log and returned 200. So the person was told to check an inbox, the audit trail recorded a code that was sent, and nothing had left the building. The only trace was one `SMTP Connection Error` line from `transporter.verify()` at startup. The reset request now reads the answer: a refused message is audited as a failure and answered 502 with words that say what to do, rather than a success that is not one. The two event access-token flows answer before the mail is away on purpose, and they now LOG a refusal (their `.catch` never ran, because the mailer answers instead of throwing).

**Three more faults of the same family, found by checking the other two backends.**

- `em_backend` and `dc_backend` had no SMTP timeouts. A mail server that is up but not answering would keep the socket open until the operating system gave up, hanging whatever request was waiting for the mail - an approval, an invitation, a token. Both now use the same three the main backend has (10 s to connect, 10 s for the greeting, 15 s on the socket).
- `em_backend` signed in with empty credentials when `EMAIL_USER` was unset, which the server refuses on every send. It now omits authentication and says so once at startup, as `dc_backend` already did.
- All three sent from a HARD-CODED address, so changing the mail account in the environment changed who the mail was sent as everywhere except in the mailers themselves. Each now sends from `config.email.from`, and each config normalizes `EMAIL_FROM` through one rule: a bare address or an address in angle brackets gets the system's name in front of it, and an `EMAIL_FROM` that already carries a display name is left exactly as it is. With the deployment's own value all three send as `IKAZE <coksystems@kigalicity.gov.rw>`.

**Proof.** Each backend's own configuration and its own mailer module loaded with the deployment's real values, against the real server: all three report the connection and the credentials accepted, all three send as `IKAZE <coksystems@kigalicity.gov.rw>`, and the main backend's own `verify()` now prints `SMTP Server is ready` where it used to print `SMTP Connection Error`. No message was sent and no secret printed. To confirm end to end on the server, inside the container:

```
docker compose -p cok-systems exec -T backend \
  node -e "require('./utilities/email').sendOTPEmail('coksystems@kigalicity.gov.rw','123456','password_reset').then(r=>console.log(r))"
```

### 11.21 The widget's menu, and three overlays that got in each other's way (2026-09-29)

**The three dots are gone.** The button at each card's corner has been removed, and everything behind it now lives in the menu the card itself opens - a right click, or a double click where there is no right button. The menu opens AT THE POINT that asked for it, and reads:

1. the records behind the widget,
2. the level below it in a cascade, named,
3. filling the screen, or coming back from it,
4. then **Other settings**, and under that heading everything the three dots used to hold: the size, what the widget can be turned into, the icon or map marker, over time, Reconfigure, Date & filters, the colour settings and Remove.

The first three are offered to any reader; the rest only to whoever may edit the board. Nothing was flattened to achieve it - `CardMenu` is the same panel, with the same size chips, the same convertible-type list and the same over-time section; it is simply opened from a point instead of from a button (a virtual anchor the popover reads a box from). A SECTION still routes its right click to the board's own menu, where a widget can be put inside it.

**The records table now reads like the form's data page.** Its head was a blue band; a band of colour above a table only competes with the table, and the two pages show the same records in the same table. The head is white, with dark words and a hairline under it.

**An image opened from that table rises above it.** `DcsFileViewerModal` rendered inline, inside the table cell, inside a panel that hides its own overflow - so a file opened from a records table appeared trapped behind the table it came from. It is now portalled to the page root at `z-index: 10090`, above the records overlay (10000), every menu (10060) and every confirmation (10070).

**A bug the measuring found in the new menu.** `MenuPopover` asked its anchor whether a click had landed inside it - `anchor.contains(event.target)`. A menu opened where the pointer was anchors to a POINT rather than an element, and a point has no `contains`, so every click while a card menu was open threw before the outside-click check ran: the menu never closed on a click away from it (Escape still did), and the console collected one TypeError per click. The check now asks whether the anchor is an element first. While there, a point-anchored menu also closes on a scroll that really moved the page: it cannot follow the page as an element anchor does, so it would otherwise hang over content that had moved out from under it.

**The cascade shows one panel, not a pile.** Going a level deeper used to add a panel on top of the last, so five levels down meant five panels on the screen at once. Only the level being looked at is drawn now; the ones above it are remembered rather than painted, the header still names the whole chain ("District > Sector > Cell") and Back returns to the level above.

### 11.22 Maps counted by category, coordinates that can be typed, and a frame in full screen (2026-09-29)

**Counting a map by a category was already there, under a name nobody would look for.** Both kinds of map take a choice field and break their measure across its values - a heat map spreads each value's own heat in its own colour, a world map plants one marker per value per place - and the control offering it was labelled "Split each place by". It is now called **Count by category**, in the three languages, which is what it does and what people were looking for. Nothing about the behaviour changed: the field list is every choice field of the form (single select - the one that draws as radio buttons - multi select, cascading select, select group and likert scale), on the heat map and the world map alike.

**What WAS missing is which fields could name a place.** `mapFields.js` recognised a level from a field's own name using a narrower list of choice types than the rest of the system - `single_select`, `cascading_select`, `select_group` - so a form whose district was captured as a multi select or a likert scale could not be mapped at all. It now uses the same list as `chartCatalog.js` and the server's `field_catalog.js`.

**The coordinates of a geolocation answer can be typed.** The latitude and longitude boxes were disabled, so a reading taken in the wrong place had to be retaken on the spot. They are editable now: the text stays as typed so a partial number can be finished, a number that reads as one and lies inside the range the earth has is committed at once, and the map - which already watches those two numbers - moves to it. The stored address belongs to the old point, so it is dropped and looked up again for the new one, exactly as the search box does. Emptying a box clears the answer rather than committing a zero, which is a real place in the Atlantic. In the form builder they are shown but not editable: there is nothing to answer there.

**A full screen board has a frame again.** It was deliberately edge to edge, which left the cards running into the sides of the screen (and, on a phone, into its rounded corners). It is padded on all four sides now, and the fit-to-screen calculation measures the room INSIDE that frame - `clientHeight` counts padding as usable room, which would have scaled a fitted board slightly too large and left its last row under the bottom edge.

### 11.23 Why the main backend's reset code arrived and em_backend's invitations did not (2026-09-30)

**They were never failing for the same reason, which is why one fix cured one of them.** The main backend was stopped by its own code - `secure: true` on port 587, section 11.20 - and the moment that value changed, forgot-password worked. `em_backend` never had that bug; it had always used `secure: false` against the same server. Its mail was being refused one step earlier, at the sign-in, and no fix to the mailers could reach that: **`em_backend`'s transporter authenticates, and its user name and password come from `EMAIL_USER` and `EMAIL_PASS` in `em_backend/.env`.** When the mail account is put into one backend's environment and not the others - by hand into `backend/.env`, or by a deployment that found no `deploy/env/shared.env` to copy from - then `backend` sends and `em_backend` offers the server an empty user name on every message. The server refuses it. That is the whole asymmetry.

**Why it was silent.** Three things hid it, all now closed:

- `em_backend` signed in with empty credentials instead of refusing to try, so the fault appeared once per message inside the mail server's answer rather than once at startup. It now omits authentication when there is no user name and says so in its log the moment it boots: `[MAIL] EMAIL_USER is not set in em_backend/.env`.
- Invitations, task notices and access tokens are sent fire-and-forget - the request answers before the mail is away, deliberately, so a slow mail server cannot hold up a page. Their `.catch` never ran, because the mailer answers `{ success: false }` rather than throwing. The two access-token flows now log the refusal.
- It had no SMTP timeouts, so a server that accepted the socket and then went quiet held the connection until the operating system gave up. It now uses the same three as the main backend.

**A trap that 11.20 opened and this round closed.** Section 11.20 made all three backends send from `config.email.from` instead of a hard-coded literal. `em_backend` had never read `EMAIL_FROM` before, so on any server whose `em_backend/.env` carried something that is not an address - `EMAIL_FROM=IKAZE`, say - the normalizer would have built `IKAZE <IKAZE>` and the server would have refused every message, on the first send, with nothing said at startup. All three configs now test for an `@` before treating the value as an address and fall back to `IKAZE <coksystems@kigalicity.gov.rw>` otherwise, so a stray value costs a display name and not the mail.

**The deployment now names the backend that cannot send.** `deploy/stack.sh` checks each of the three stored env files for the five mail keys and reports them one line each, and a backend with no file in the stack's store at all is warned about rather than skipped in silence - it was the silent skip that let one backend keep the mail account and another go without it:

```
==> Sign-in and mail settings of uat-ikaze
   [ OK ] backend.env carries the mail account (coksystems@kigalicity.gov.rw via 197.243.27.181)
   [WARN] em_backend.env cannot send mail: no EMAIL_HOST EMAIL_PORT EMAIL_USER EMAIL_PASS EMAIL_FROM
   [WARN] dc_backend.env is not in uat-ikaze's store at all - it gets no mail account, no database line and no JWT_SECRET from this run
```

**Proof that nothing in em_backend's own code stops an invitation.** Its configuration, its calendar builder and its mailer were loaded with the deployment's real values and the invitation composed through a nodemailer transport that writes the message instead of sending it: the configuration resolves to `197.243.27.181:587` as `coksystems@kigalicity.gov.rw` from `IKAZE <coksystems@kigalicity.gov.rw>`, the calendar builds (61 lines, 1579 characters, with `METHOD:REQUEST`, `ORGANIZER` and `ATTENDEE`), and the message composes with all three parts - html, text and calendar. Nothing left this machine. To settle it on the server, in one command each:

```
docker compose -p cok-systems exec -T em-backend printenv | grep -E '^EMAIL_'
docker compose -p cok-systems logs --tail 40 em-backend | grep -iE 'smtp|\[MAIL\]'
docker compose -p cok-systems exec -T em-backend \
  node -e "require('./utilities/email').sendEmail('coksystems@kigalicity.gov.rw','Test','<p>test</p>').then(r=>console.log(r))"
```

### 11.24 A mail transport that finds out instead of assuming (2026-09-30)

**What went wrong with the previous fix.** Section 11.20 changed one assumption for its opposite. The main backend had `secure: true` on port 587, which a workstation's own measurement says cannot work, so it was set to `false` - and the reset code, which HAD been arriving, stopped arriving and the request started answering 502. Both settings are defensible in the abstract and neither can be trusted in this network. Measured from a city workstation against the real server, on the same afternoon, in the same minute:

```
197.243.27.181:587
  refused   secure:true   TLS from the first byte        330 ms   ESOCKET wrong version number
  refused   secure:false  STARTTLS mandatory           20932 ms   ETIMEDOUT
  refused   secure:false  STARTTLS optional            21120 ms   ETIMEDOUT
```

The first answer comes back in a third of a second and says the port is NOT speaking TLS. The other two time out, which says nothing about the port and everything about the path between this machine and it. Earlier in the week the same probe from the same machine connected and had its credentials accepted in 2.7 s. A value chosen from evidence like that is a guess wearing a measurement's clothes, and guessing wrong here does not degrade the mail - it stops the mail, silently, because a failed handshake looks exactly like a mail server that is down.

**So the source no longer decides.** `utilities/mail_transport.js`, one identical copy in each of the three backends, is now the only way any of them reaches a mail server. It tries the way the environment asks for, and if the CONNECTION fails - refused, timed out, or a TLS handshake against a port that answers in the clear - it tries the SAME message the other ways before anybody is told it could not be sent:

- TLS from the first byte, as port 465 does,
- in the clear, then STARTTLS, required,
- in the clear, STARTTLS only if offered - the last resort, because a server that does not advertise STARTTLS refuses every message while `requireTLS` is on, and refusing to send at all is worse than sending the way that server asks for.

`EMAIL_SECURE` puts one of them first (`true`, `false`, or nothing, in which case port 465 means TLS-first and anything else means STARTTLS). Whichever way the server accepted is remembered for the life of the process, so the extra attempt is paid once after a restart and not per message. A refusal that is NOT about the connection - wrong password, unknown recipient, message too large - is not retried, because the same credentials a second way would only slow the answer down. Every attempt is logged, so the log states how the server wants to be talked to:

```
[MAIL] em_backend: TLS from the first byte (as port 465 does) did not connect (ESOCKET: wrong version number) - trying in the clear, then STARTTLS (required) for this message
[MAIL] em_backend: 197.243.27.181:587 answers in the clear, STARTTLS only if offered
```

**What this settles for em_backend.** It now reaches the mail server through exactly the same transport as the backend whose mail arrives, so it can no longer be the one backend that is talking to the server the wrong way. On top of that: it says `[MAIL] em_backend: SMTP server is ready` or one sentence naming the host, the code and what to check when no way of connecting was accepted; `dc_backend`, which said nothing at all at startup, now says the same; and re-activating a cancelled invitation reads the mailer's answer instead of discarding it, so a refused invitation is no longer indistinguishable from a delivered one (the re-activation itself still succeeds - it is the mail that is reported).

**`EMAIL_SECURE` is a shared key too**, optional: `deploy/stack.sh` writes it into all three backend envs when `deploy/env/shared.env` names it, and never complains when it does not, because a backend that is left to find out for itself is not misconfigured.

**Proof.**

- `backend/tests/mail_transport.test.js` (permanent, no dependencies, nothing leaves the machine): against a mail server that speaks plaintext only and does not offer STARTTLS, with `EMAIL_SECURE=true` - the exact production mistake - the message is still delivered, the recipient survives the retry, the failed way and the working way are both named, the second message does not repeat the discovery, `EMAIL_SECURE=false` is not overridden by trying TLS first, a server that is genuinely absent still raises `ECONNREFUSED` rather than looking like a success, and a backend with no `EMAIL_USER` says so when it boots. 4 cases, `ALL_TESTS_PASSED`.
- Each backend's OWN message through the same fake server, with the setting deliberately wrong: em_backend's event invitation (delivered, carrying `BEGIN:VCALENDAR` and `METHOD:REQUEST`, addressed to the attendee, sent from the system's account), em_backend's task notification, the main backend's password reset code (the code present in the body), and dc_backend's approval request. 12 checks, 0 failed.
- `node test.js` in any backend sends one message through this transport and reports which way the server answered. The same script is now in all three.

**One thing to know about where a backend's environment comes from.** `backend/Dockerfile` and `em_backend/Dockerfile` both end with `COPY .env .env`, so each image carries a COPY of the environment it was built with, and `docker-compose.yml` also hands the same file in through `env_file`. Either way the value a container uses is fixed when the image is built and the container created - which is why a deployment that only restarts the containers can leave one backend running last month's mail account while another has this month's, and why `update-deploy.sh` builds with no cache and recreates the containers on every run (11.19). A mail setting that is changed and not deployed that way has not been changed.

### 11.25 The main backend keeps its own mailer, and production settles the argument (2026-09-30)

**`backend/utilities/email.js` is restored, byte for byte, to the version that was delivering** - its state at commit `27521f31`, with `secure: true` and its own `const EMAIL_FROM = 'IKAZE <coksystems@kigalicity.gov.rw>'`. `backend/test.js` and `backend/configurations/config.js` are back to their state before that round as well, and `backend/utilities/mail_transport.js` no longer exists in that backend. Nothing from 11.20 or 11.24 remains anywhere in the main backend's sending path; `git diff 27521f31 -- backend/utilities/email.js` is empty.

**And production settles what the reasoning could not.** 11.20 argued from the protocol that `secure: true` cannot work on port 587, and this file's own comment says the same thing. The city's server disagrees: with `secure: true` the reset code was arriving, and with `secure: false` the request answered 502. Whatever sits in front of 197.243.27.181 - relay, appliance, firewall - wants TLS from the first byte on its submission port, and a comment does not get to overrule an inbox. **The claims in 11.20 and 11.24 that STARTTLS is the correct answer for this server are wrong, and this note corrects them.** What survives from 11.20 is narrower and still true: `secure: true` FAILS from a city workstation in 330 ms, which is why the measurement taken there pointed the wrong way, and a value chosen from one machine's answer was never safe.

**So the self-correcting transport stays where the mail was not arriving.** `em_backend` and `dc_backend` keep `utilities/mail_transport.js`, and `EMAIL_SECURE=true` in `deploy/env/shared.env` now puts TLS-from-the-first-byte first for them - the way the backend that delivers has always opened its connection. The fallback is what remains for the case this note cannot rule out: if that stops being the answer on some server, those two try the other ways, deliver anyway, and say in the log which way was accepted, instead of going quiet. The main backend does not need it, because the main backend was never the one that could not send.

**The permanent test moved with the module**: `dc_backend/tests/mail_transport.test.js`, which the DCS suite runs (`node --test tests/*.test.js`), covering the copy that is actually in use. 4 cases, `ALL_TESTS_PASSED`.

**One thing left standing on purpose.** `request_reset.js` still answers 502 when the mail server refuses the reset code, rather than 200 with "check your inbox". That is the message quoted back at me twice, and it is only ever seen when a code genuinely did not leave the building - the alternative is what hid this fault for weeks, including an audit line that recorded a code as sent. It is one line to put back if the 200 is wanted.

**Proof that the restored mailer is the working one.** `backend/utilities/email.js` was loaded EXACTLY as restored, with no edits, against a local mail server holding a throwaway certificate and speaking TLS from the first byte the way this city's server does. It reports `{ success: true }`, the server receives the message, the reset code is in the body, it is addressed to the person who asked, and it is sent as `IKAZE <coksystems@kigalicity.gov.rw>` from its own constant - with `EMAIL_FROM` deliberately set to `NONSENSE` and correctly ignored, as it was when the mail was arriving. The condition `request_reset.js` uses to choose between 200 and 502 evaluates to 200. 6 checks, 0 failed; the certificate was destroyed afterwards and nothing left the machine. The DCS suite, which now includes the transport test, is 10 files, 10 pass, 0 fail.

### 11.26 What the server itself says, and the correction it forces (2026-09-30)

**Measured on the production server, not reasoned about.** `deploy/mail_check.js` (new) reads each backend's `.env`, knocks on every candidate host and port, prints what the server says FIRST, and then tries each way of signing in. Run on `ikaze-sys`:

```
OPEN     197.243.27.181:587    31 ms  says: "220 proxymta-server.aos.rw ESMTP Postfix"
OPEN     197.243.27.181:25      4 ms  says: "220-proxymta-server.aos.rw ESMTP Postfix"
open     197.243.27.181:465  6002 ms  opened but said nothing
blocked  mail.kigalicity.gov.rw:587    ECONNREFUSED
blocked  mail.kigalicity.gov.rw:25     ECONNREFUSED

refused  197.243.27.181:587  secure:true    42 ms  ESOCKET wrong version number
refused  197.243.27.181:587  secure:false  15061 ms  ETIMEDOUT
refused  197.243.27.181:465  secure:true   10002 ms  ETIMEDOUT connection timeout
```

**This corrects 11.25.** That section said production had settled the argument in favour of `secure: true`, on the strength of a report that mail had been arriving with it. The server disagrees: with `secure: true` the connection is refused in 42 milliseconds with OpenSSL's "wrong version number", which is what happens when TLS is opened against a port that has just answered in plain text - and port 587 there answers `220 proxymta-server.aos.rw ESMTP Postfix` in 31 ms. **No message has been leaving the main backend on `secure: true`.** 11.20's reading of the protocol was right about this port after all; what was wrong in 11.20 was changing a file on the strength of reasoning, and what was wrong in 11.25 was accepting a recollection as a measurement. The setting in `backend/utilities/email.js` stays as the user set it until the user says otherwise - it is their file and their call - but it cannot send.

**And `secure: false` does not send either.** The banner arrives and then the server stops: `ETIMEDOUT` at 15061 ms, which is the socket timeout rather than the greeting timeout, so the greeting WAS received and the EHLO after it was not answered. That is not a setting. Two things can produce it and they need different people to fix them: a server slower to answer EHLO than the backends' 15 second socket timeout, or a conversation that is cut after the greeting by an anti-spam front, a relay policy or a middlebox - `proxymta` in the banner, and the multiline `220-` form on port 25, are the signature of exactly such a front.

**So `deploy/mail_dialogue.js` (new) holds the whole conversation by hand** - connect, banner, EHLO, STARTTLS, the TLS upgrade, `AUTH LOGIN`, QUIT - printing every line with the milliseconds it took and waiting 60 seconds a step, far longer than any backend would. Its verdict names which of the two cases it is, and therefore whether the answer is a timeout in this repository or a question for whoever runs the mail server. It never prints the password, and it says in its own header to be run ONCE, because a mail server fronted like this one can block an address that keeps failing handshakes.

Proven against two stand-in servers on 127.0.0.1: one that answers EHLO after 2.5 s (waited for, not called silence, and its offered STARTTLS and AUTH reported) and one that greets and then says nothing (reported against EHLO, with the verdict naming the conversation as cut rather than misconfigured, and saying who has to fix it). 6 checks, 0 failed.

**Neither of the other candidates is the answer**: `mail.kigalicity.gov.rw` - the address this code defaulted to before 2026-09-29 - refuses 25 and 587 outright, and port 465 on both hosts accepts a TCP connection and then completes no handshake at all, which is a firewall accepting a connection on the server's behalf and passing nothing on.

**`deploy/mail_dialogue.js` tries four things, not one.** Silence after a banner has four possible causes and they are not equally likely, so each is tried on its own fresh connection, in order of what costs least to believe: EHLO with a full domain name; HELO with it; EHLO with the bare machine name a mailer sends by default (`ikaze-sys`, which a strict mail server or an anti-spam appliance will quietly stall); and then port 25, which greeted that server in 4 ms and can be open to a machine that the submission port is closed to. The first combination that answers is carried through STARTTLS, the TLS upgrade and `AUTH LOGIN`, and printed as the exact `EMAIL_*` lines to deploy - including a line saying the name or the older verb was what mattered, because that is a change to make in the mailers and not in an env file. If nothing answers, the verdict says so plainly, lists every attempt, and prints the three questions to put to whoever runs the mail server, with the timed transcript as the evidence.

Proven against four stand-in servers on 127.0.0.1 - one merely slow, one silent whatever is said, one that stalls a bare name and answers a dotted one, one that wants HELO rather than EHLO: 11 checks, 0 failed.
