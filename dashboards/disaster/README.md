# Disaster boards for the DMIS form

The seven boards of `dmis_dash.html` (City of Kigali - Disaster Dashboards), rebuilt as DCS dashboards for the DMIS assessment form (form group `ef2401f3-f5ab-4e0e-a02a-ec28e2e76ebd`, project `6aa1be687372ebbcef6e11f2`). Each JSON file is one board, in the exact shape the dashboard's Ctrl+6 overlay accepts: `{ "name", "filters": [...], "widgets": [...] }`.

Unlike the HTML, which shows fixed sample numbers, these boards compute every figure live from the form's submissions, follow the board's date filter and its District / Sector / Hazard filters, and open the records behind any card, bar or table row on a click (a cell too, in a table whose columns are the values of a field).

## Files

| File | Board of the HTML | Widgets |
|------|-------------------|---------|
| `01-impact-on-households-by-district.json` | Disaster impact on HH by district | 2 panels: district cards + table of households, casualties and damaged structures per district; district cards + table of facilities per district and type |
| `02-spatial-distribution-housing.json` | Spatial distribution - disaster impact on housing | district cards, how houses were damaged by hazard (stacked bars), damaged houses per month |
| `03-spatial-distribution-hazard-health.json` | Spatial distribution - hazard and health impacts | district cards (no total, as in the HTML), deaths by hazard (treemap), the HEALTH IMPACTS VS HAZARDS note, casualties per hazard (table - an addition: it carries the Missing and Trauma figures the HTML's mosaic wrote by hand) |
| `04-spatial-distribution-facilities.json` | Spatial distribution - facility impacts | district cards, facilities by type and hazard (stacked bars), the Facilities vs. Hazards note |
| `05-spatial-distribution-districts-vs-hazards.json` | Spatial distribution - districts vs hazards | district cards, households per district by hazard (stacked bars), the DISTRICTS vs HAZARDS note, households per month |
| `06-hotspot-monitoring-summary.json` | Hotspot identification and monitoring - summary | district cards, the four risk tiles (High / Moderate / Low / No risk), OBSERVATIONS and RECOMMENDATION |
| `07-hotspot-monitoring-assets.json` | Hotspot identification and monitoring - assets | district cards, hotspots by type of asset and risk (stacked bars), the Dominant High-Risk Assets note, hotspots per month |

`build_boards.js` generates the seven files (run `node build_boards.js` in this folder after editing it - the JSON files are its output, do not edit them by hand). `validate_boards.js` and `compute_boards.js` are the checks described under Verification. `logs/` holds their output.

## How to load a board

1. Open the DMIS form's dashboard page (`/dcs-system/project/6aa1be687372ebbcef6e11f2/forms/ef2401f3-f5ab-4e0e-a02a-ec28e2e76ebd/dashboard`).
2. Create a dashboard with the board's name (or open an existing one), then press Ctrl+6 (Cmd+6 on a Mac).
3. Copy the whole content of the board's JSON file into "Paste dashboard JSON here".
4. Choose "Replace the board". The server validates every widget against the form before saving.

Repeat for each of the seven files, one dashboard each - the dashboard switcher in the header then moves between them like the dropdown of the HTML. The backend must be running a build that includes the engine additions below (restart it once after deploying).

## What each board is made of

Every board is one dark **panel** (a canvas coloured `#14318f` with a `#0d2472` border) holding, in the HTML's order:

- a **title band**: a text block with the heading only, size large, centred, on `#0d2472`;
- the **district row**: one KPI card per district (Gasabo, Kicukiro, Nyarugenge) and a TOT card, on `#173a9c` with a white border, each 24% of the row. Every one is **pinned on the District field**, so filtering the board to one district drills the charts down to its sectors while these cards keep showing all three;
- the board's figures: a **summary table** where the HTML draws a table (one row per district or per hazard, a column per measure or per facility type - the facility types beyond the thirty most frequent fold into an Other column - a Total row and, for the facility table, a Total column, exact figures with shortening turned off; option codes read as the form's own labels), **stacked bars** where it draws bars (coloured with the HTML's hazard or risk colours, value labels renamed to the HTML's words), a **line per month of the incidence date** where it draws its trend line, and a **text block** where it prints observations. The figures inside those notes are LIVE: written as `{{sum(number_271ca1 | single_select_7c5216 = rain_wind)}}` (injuries from rain-and-wind events), `{{count(single_select_f42575 = high)}}`, `{{share(single_select_f42575 = high)}}` and so on, they are computed under the board's filters and date every time the board is read, and `==highlight==` paints them in the HTML's `#39d7ff`. Each note carries its module as its own filter (household loss, infrastructure or hotspot) so its figures count within that module.

The board filters are District, Sector and Key driver (hazard) on every board, plus Risk status on the two hotspot boards. Boards open on "This year" like every dashboard; pick "All" in the period filter to read everything the form holds.

## Field mapping

| HTML | Form field | Id | Values used |
|------|-----------|----|-------------|
| District cards, table rows | District | `cascading_select_8dz9o8` | Gasabo, Kicukiro, Nyarugenge |
| Sector filter | Sector | `cascading_select_v0mxca` | |
| Which module a record is | Purpose of assessment | `single_select_4d066b` | household_loss, infrastructure, hotspot |
| Months of the trend lines | Incidence time | `date_time_07fa41` | |
| Deaths, Injured, Trauma, Missing | D1-D4 | `number_ca002e`, `number_271ca1`, `number_9a0824`, `number_07a4a8` | summed |
| Hazard legend (Fire, Rain, Rain&Wind, Wind, Inkuba) | D7 Key driver | `single_select_7c5216` | fire `#e8542a`, heavy_rain "Rain" `#1f5fc4`, rain_wind "Rain&Wind" `#15b3e0`, wind `#8a3fb0`, lightning "Inkuba" `#7fb2ff` |
| All houses | D10 Is there any house damaged | `single_select_998282` | yes |
| Roof, Wall, Slightly, Flooded, Completely, HRZ | D11.2 How the house was damaged | `single_select_8c0eb4` | roof_blown_off_d, walls_damaged, lightly_damaged, flooded_water_entered, completely_destroyed, high_risk_zone |
| Annex, Kitchen, Fences, Retaining wall | D11.3 Other structures damaged | `multi_select_b293aa` | annex_extension, kitchen_struct, fence_enclosure, retaining_wall_struct |
| HH Name | C1 Head of household | `text_d8f416` | counted when answered |
| Facility columns | B2 Type of facility | `cascading_select_3ec652` | every value present |
| Hotspot assets | A1 Type of hotspot | `cascading_select_b49b76` | every value present |
| Risk tiles and legend | A3 Risk status | `single_select_f42575` | high `#e0393e`, moderate `#e8951e`, low `#1a9ad6`, no_risk `#1fae6b` |

The HTML's "Inkuba" series has no separate value on the form; it is the `lightning` driver renamed. The HTML's "HH Name" column is a count of household records whose head-of-household name was given.

## Engine additions these boards rely on

Added on 2026-09-25 to the dashboard engine (see `../changes-and-creations.md`, section 11):

- **Text blocks** (`chart_type: "text"`): title bands, observations, recommendations. Builder tab "Text", or right-click -> "Add a text block here".
- **Tables** (`chart_type: "table"`): a records table (chosen fields, 10-100 rows a page, Previous / Next) or a summary table (rows per value, columns per measure or per value of a second field, totals). Builder tab "Table".
- **A widget's own fixed date** (`period.locked: true`): the card keeps its window whatever the board's date filter says, and wears a "Fixed: ..." chip. Card menu -> "Date & filters".
- **Pinned fields** (`pinned_fields`): the board filters a widget refuses to follow, so a row of district cards stays a row of district cards. Same dialog; the card wears an "Ignores filter: ..." chip.

## Sharing a board

Share links (dashboard page -> Share links) carry an advanced configuration per dashboard: free or fixed filters, a fixed period, whether viewers may open records (and which fields), the link's own title, and the **colour mode viewers see** - their own choice, always light, or always dark. The disaster boards were drawn for their own blue panels and read the same in either mode; pick "Always dark" when the page around them should be dark too and the light/dark switch should not be offered.

## Editing a board

- Change the words of a note: right-click it -> "Reconfigure" opens the Text tab with its heading and body. "Live figures" under the body inserts a computed figure where the cursor is - pick the formula, the field, an optional value and an optional condition - and "Preview with real data" shows the note with today's numbers.
- Change a table's columns: right-click -> "Reconfigure" opens the Table tab; measures are edited one by one (label, formula, field, optional filter).
- Colours: right-click -> "Colour settings" (a table's numbers use the widget's number colour; `compact` is off on the tables so figures are exact).
- Make a card keep its own dates: card menu -> "Date & filters" -> choose the window and switch on "Always follow this window".
- To regenerate all seven files from scratch, edit `build_boards.js` and run it, then run the two checks.

## Verification

- `node validate_boards.js` - every board through the server's own `sanitize` -> `validate_dashboard` -> `validate_filter_defs` against `DMIS_Assessment_Form.json`, plus an unknown-field scan. Output: `logs/validate_boards.log`.
- `node compute_boards.js` - an in-memory MongoDB seeded with 240 DMIS-shaped submissions; every widget of every board computed through `compute_dashboard_results` with no filters, with District = Gasabo, and with a March 2026 period; fails on any INVALID / FAILED widget, a text block carrying data, a summary table missing its total row, or a pinned card following the district filter. Output: `logs/compute_boards.log`.
- `node --test --test-concurrency=1 tests/*.test.js` in `dc_backend` - the engine's unit tests, including `dashboard_features.test.js` for the four additions. Output: `logs/backend_tests.log`.
- `npx tsc --noEmit` and `npx vite build` in `frontend`. Output: `logs/frontend_build.log`.
