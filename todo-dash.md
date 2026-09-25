# Disaster dashboards - to-do

Goal: rebuild the seven boards of `dmis_dash.html` inside the DCS dashboard engine for the DMIS form (`ef2401f3-f5ab-4e0e-a02a-ec28e2e76ebd`), so that they look as close to the HTML as the engine allows, and add to the engine what those boards need but it did not have. Every item is ticked when it is done AND verified (tests or build), not when it is written.

## 1. Understand
- [x] Read `dmis_dash.html` (seven boards, their helpers: card, total, title, legend, text, bars, line, table)
- [x] Read the dashboard engine: backend `dc_backend/util-dashboard/*` (constants, sanitize, validation, board filters, match stage, pipelines, widget data, KPI metrics, records) and frontend `frontend/src/systems/dcs/util-dashboard/*` (builder, composers, card, charts, filters, code overlay, creation guide)
- [x] Read the DMIS form (`DMIS_Assessment_Form.json`, 189 fields) and the earlier eleven role boards + `dashboards/changes-and-creations.md`
- [x] List what the HTML boards use that the engine lacks: text blocks (titles, observations, recommendations), aggregate tables with totals (district x measures, district x facility type), a records table, widgets that keep their own date, widgets that keep their district breakdown when the board is filtered

## 2. Engine - backend (`dc_backend/util-dashboard`)
- [x] Fixed date on a widget: `period.locked` - a locked widget ignores the board's period (constants, sanitize, validation, `effective_bounds`)
- [x] Pinned fields: `pinned_fields` - board filters on those fields (and the fields below them in a cascade) are not applied to the widget: no drill-down, no narrowing (`board_filters.apply_board_filters`, sanitize, validation)
- [x] Text widget: `chart_type: "text"` with `text: { heading, body, align, size, accent }`; reads no data; light markup (`**bold**`, `==highlight==`, blank line = new paragraph)
- [x] Table widget: `chart_type: "table"`, `table.mode: "records"` (chosen fields, page size 10-100, sort, paging) and `table.mode: "summary"` (rows = values of group_by; columns = split values or measure columns with their own filters; total row and total column)
- [x] `widget_data.js` dispatches the two new kinds; `table_data.js` holds the pipelines
- [x] Unit tests with mongodb-memory-server: `tests/dashboard_features.test.js` (locked period, pinned fields, records table paging and clamping, summary table with totals and split columns, text kind, validator refusals) - `ALL_TESTS_PASSED`

## 3. Engine - frontend (`frontend/src/systems/dcs/util-dashboard`)
- [x] Chart catalog mirrors the two new types; data signature carries `table` and `pinned_fields`
- [x] `TextWidget.jsx` renders a text block from the widget's own colours; `TextComposer.jsx` in a new "Text" tab of the builder
- [x] `TableWidget.jsx` renders both table modes (sticky header, first column, totals, page size 10-100 with Previous / Next); `TableComposer.jsx` + `TableColumnsEditor.jsx` in a new "Table" tab
- [x] "Date & filters" dialog on every data widget (card menu and right-click): own time window + "always follow this window", and the board filters the widget ignores (pinned fields); chips on the card say what is fixed
- [x] Paging a table widget refetches only that card (`useBoardData.page_widget`); text widgets fetch nothing
- [x] Ctrl+6 creation guide and paste normalizer document and keep `text`, `table`, `pinned_fields`, `period.locked`
- [x] i18n keys added to en / fr / kn (same count in all three)
- [x] `tsc` and `vite build` green

## 4. Disaster boards (`dashboards/disaster/`)
- [x] `01-impact-on-households-by-district.json`
- [x] `02-spatial-distribution-housing.json`
- [x] `03-spatial-distribution-hazard-health.json`
- [x] `04-spatial-distribution-facilities.json`
- [x] `05-spatial-distribution-districts-vs-hazards.json`
- [x] `06-hotspot-monitoring-summary.json`
- [x] `07-hotspot-monitoring-assets.json`
- [x] `README.md` in the folder: how to load, what each board shows, the field ids and colours used, how to edit

## 5. Verify (logs in `dashboards/disaster/logs/`)
- [x] Every board file parses, every field id exists on the DMIS form, every widget passes `sanitize` + `validate_dashboard` + `validate_filter_defs` (`validate_boards.js` -> `validate_boards.log`)
- [x] Every widget of every board COMPUTES against seeded DMIS-shaped records in an in-memory MongoDB with no INVALID / FAILED result, tables carry totals, text widgets carry no data (`compute_boards.js` -> `compute_boards.log`)
- [x] Backend unit tests (`node --test dc_backend/tests`) -> `backend_tests.log`
- [x] Frontend `tsc` + `vite build` -> `frontend_build.log`

## 5b. Found and fixed on the way
- [x] A widget inside a canvas was refused at data time ("the canvas it sits in is not on this dashboard") because each data request validates one widget alone; nesting is now checked at save time only (`validate_dashboard(..., { nesting: false })` in `compute_results.js` and `widget_records.js`)
- [x] Text blocks no longer need a title (a title band is heading only)
- [x] The test machine had 21 orphaned `mongo-mem-*` folders (3.7 GB) filling the disk so the in-memory MongoDB could not start; removed

## 6. Document
- [x] `dashboards/changes-and-creations.md`: new section on the engine additions and the disaster folder
- [x] This file kept current

## 7. Follow-ups asked for after the review
- [x] Table headers and total rows readable on dark cards (tint of the widget's text colour over its own surface)
- [x] "Ignores filter" chip removed from cards (the "Fixed" chip stays)
- [x] Share link advanced configuration: colour mode for viewers (free / always light / always dark); public page pinned, switch hidden, chip in the links list
- [x] Dashboard switcher: tick several dashboards, make their names uppercase, or delete them after a confirmation
- [x] Backend controllers load, frontend files parse, i18n keys complete, `tsc` + `vite build` green

## 8. Live figures in notes, and file names
- [x] Text blocks compute figures written as `{{count}}`, `{{count(field = value)}}`, `{{sum(field | other = value)}}`, `{{share(field = value)}}` and the rest (`text_data.js`); validator refuses bad tokens; unit tests
- [x] Composer helper "Live figures" inserts a token at the cursor with suggestions; "Preview with real data"
- [x] Every observation note of the seven boards rewritten with live figures (no typed numbers), scoped to its module
- [x] Board names without their numbers ("7. Hotspot..." -> "Hotspot..."); file names keep the 01-07 order; checks and README follow
- [x] Backend tests, board validation and computation, frontend build all green again

## 9. Confirmations
- [x] The confirm dialog opens above the dashboard switcher (and every popover) instead of behind it
- [x] Deleting ticked dashboards works (the list no longer closes and forgets the ticks when the confirmation is clicked) and shows a spinner while it runs
