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

## 10. Flattened boards
- [x] No canvases, no boxes, no blue panels in the seven boards: plain widgets on the grid with the default white card; hazard and risk colours only on series and tile numbers
- [x] Boards validate and compute again; README and change log describe the flat layout

## 11. Drill and stacked-value titles
- [x] A card stacked on one value of an ignored filter always names it: left alone when the title says it, added in brackets when the author's title does not ("Deaths (Gasabo)")
- [x] Hover bar on cascade cards: left the table, right the level below (stacked overlays down to the last level; fixed value narrows to its children); always shown and full-screen on phones and tablets
- [x] Public page receives the cascade chains; frontend build green

## 12. Runtime fix
- [x] Card render crash ("cannot access before initialization") fixed: the title reads the palette after it is declared; build green

## 13. Widgets without a form id
- [x] `form_group_id` removed from every widget of the seven board files (generator, regenerated JSON); the form comes from the page the JSON is pasted on and the server stamps it
- [x] Creation guide: no form id under `form`, none in the examples, a rule that says a widget never names its form and that such keys are dropped
- [x] Copying widgets out of the Ctrl+6 overlay strips the form id
- [x] Boards validate and compute without it; frontend build green

## 14. Map boundaries in a fresh browser
- [x] Root cause found: the map waited for the remote basemap's `load` before drawing anything and the 20-second watchdog blamed the boundaries; the map is now ready on `style.load` and draws the boundaries while the basemap streams in
- [x] A map engine that cannot start says so (WebGL message in en/fr/kn); a failed boundaries request shows the server's reason
- [x] Every boundary of the drawn level is shown: the server sends the rest of the level as context (capped at 200 places), the card draws it pale, frames it and names it
- [x] Parent walk keeps repeated names (a cell named like its sector no longer opens the whole sector)
- [x] Review findings fixed: controller forwards have / have_level / have_context (held shapes and context no longer travel twice); a drawn place cannot satisfy a filter by its own name; one name from two unrelated filter fields travels once; retry races in the map keeper closed; watchdog cleared when a late map comes up

## 15. Map background on a slow link
- [x] The basemap is fetched beside the map (45 s limit, shared, retried on a widening schedule) and slid under the widget's layers when it comes; a style that came once is kept in the browser for the next page
- [x] A note in the corner says the background is loading, or unavailable with a click to retry; the boundaries never wait
- [x] MapChart under 500 lines; three language files in step; build green; browser proof re-run (note shown while the basemap hangs, gone once it is in)
- [x] Proof: `map_shapes.test.js` passes against the real Kigali tree (all 1,361 places found, context and cap checked); backend suite green; frontend build green
- [x] Browser proof: a real headless browser (Edge, WebGL2 via SwiftShader) with the basemap hanging draws all three districts within 6 seconds and never shows the veil; the committed code reproduced the bug at 23 seconds; logs and screenshots saved in dashboards/disaster/logs/map_proof*.log and map_proof*.png

## 16. KPI card sizes and rows that fill themselves
- [x] Four sizes for a KPI card, offered in its own menu: xs (12 a row), small (6), medium (4), large (3); "xs" accepted by the server and documented in the creation guide
- [x] A card's number, title, description, legend and padding scale to the width it ended up with; the icon is dropped where it would leave no room for the figure
- [x] One flowing grid: a widget takes a new row only when it does not fit, whatever a row holds widens evenly to fill it, and cards and charts can share a row
- [x] Measured in a real browser: 12 xs on one row, 10 xs filling the row, 10 xs pushing a medium chart to the next row, 2 small cards sharing a row with a medium chart (42 checks, 0 failures; logs/board_proof.log and its six screenshots)

## 17. A board's own colours
- [x] Background and widget-border colours saved per dashboard; text, muted tones, grids and empty areas worked out from the background so nothing is unreadable
- [x] Border and text may be set by hand or put back to automatic; the whole board can be reset to the usual colours
- [x] "Paint every dashboard of this form the same way" writes them across the form's boards in one call, touching nothing else
- [x] A widget's own background or border still wins; its colour dialog shows what is inherited and resets back to the board
- [x] Shared links carry the colours; the light/dark toggle steps aside on a coloured board
- [x] Backend test green (mongodb-memory-server), whole suite green, frontend build green

## 18. How the board reads and behaves
- [x] The hover bar carries its whole label at any card width: it wraps instead of clipping, the halves take a line each on a narrow card, and the font follows the measured width
- [x] The cascade overlay: every panel the same width as its parent, nothing reaching outside the screen (the panel is also a board, and a board is width:100%, which over-constrained the absolute box; sized by its four edges now: 1368px wide, 16px of gutter on both sides)
- [x] "Show more" is reachable: the card's area scrolls in both directions instead of clipping a grown chart or a long legend
- [x] No "fill the screen" button on a phone or a tablet
- [x] The KPI tab offers the card's four sizes and builds every card at the chosen one
- [x] Board colours: an explicit choice between this dashboard and every dashboard of the form
- [x] A colour set on a widget survives dark mode and a painted board; its words stay readable
- [x] A text block (and a canvas) shows its three-dots menu while the board is editable: size, colours, reconfigure, date and filters, remove
- [x] Measured in a real browser and the build green (13 scenarios, 108 checks, 0 failures, 0 console or page errors)

## 19. One menu per widget
- [x] No control on a card waits for a hover: the two-part bar and the corner expand button are gone, and so is the hovered description placeholder
- [x] A right click, or a double click, opens one menu holding the table, the level below, filling the screen, and everything an editor can change
- [x] The viewing actions open for a reader too, not only an editor; a click on a mark still opens that mark's records; a map keeps its two clicks and answers a long press
- [x] The cascade overlay carries the table and the next level as buttons in its header
- [x] A text block's words scale with the card's width and with their own length, down to 8px, then the area scrolls
- [x] "Back to the usual colours" takes its own row rather than sitting behind the buttons (layout applied; not separately measured)
- [x] The menu no longer shuts itself on a long board: it closes on a scroll that really moved the page, not on the browser's own scroll-anchoring event
- [x] A non-KPI widget asked for the xs size takes a third of a row rather than half
- [x] Build green and measured in a real browser (18 scenarios, 163 checks, 0 failures)

## 20. Every deployment starts from nothing
- [x] Images built with no cache and a fresh pull; every container recreated with its anonymous volumes renewed, so the new .env is always read
- [x] Mongo and every named volume (databases, uploads, certificates) left alone; unused images and the build cache dropped afterwards
- [x] The build runs before the swap, so the site and the page that asked for the deployment stay up while it builds
- [x] --keep-cache and --fresh-env; the same behaviour for both Deployment Management buttons, which run this same script
- [x] The five EMAIL_* keys written into all three backends of every stack from deploy/env/shared.env (git-ignored) or an x-email block of docker-compose.yml
- [x] Proven: the dry run prints the exact commands; the env writing exercised on a sandbox store (five keys land, an old value is replaced not duplicated, JWT and mongo lines survive, a second run changes nothing)

## 21. Email
- [x] Root cause: the main backend used secure true on port 587, so every send failed the TLS handshake before reaching the server; measured both ways against the real server
- [x] The reset request no longer reports success when the mail was refused: it audits the failure and answers 502
- [x] The two event access-token flows log a refusal instead of hiding it
- [x] em_backend and dc_backend given the same SMTP timeouts, so a silent mail server cannot hang an approval or an invitation
- [x] em_backend no longer signs in with empty credentials; it says so at startup like dc_backend
- [x] All three send from the configured address, normalized to carry the system's name, so changing the account in the environment really changes the sender
- [x] Proven: all three backends' own configs and mailers accepted by the real server, all sending as IKAZE <coksystems@kigalicity.gov.rw>

## 22. The widget's menu and the overlays
- [x] The three-dots button removed; everything it held is under "Other settings" in the menu the card opens at the pointer, on a right click or a double click
- [x] The view actions (table, next level, full screen) sit above that heading and are offered to a reader too
- [x] The records overlay's head is white (measured rgb(255,255,255)), like the form's data page
- [x] A file opened from a records table is portalled (parent is the page body, z-index 10090, topmost at its centre) to the page root and rises above the overlay, the menus and the confirmations
- [x] The cascade draws one panel at a time (1 panel at every depth, the same box each time); Back and the breadcrumb carry the chain
- [x] A point-anchored menu closes on an outside click and on a real page scroll: asking a point anchor for contains threw on every click and left the menu standing
- [x] A canvas still opens the board's own menu, and an editable map's menu carries the marker picker and the map kind
- [x] Build green and measured in a real browser (20 scenarios, 213 checks, 0 failures, 0 page errors)

## 23. Maps, coordinates and the full screen frame
- [x] The map's count-by-category control renamed from "Split each place by" in the three languages; it already worked on both heat and world maps, for every choice field including single select
- [x] Which fields can name a place now uses the same choice types as the rest of the system, so a district captured as a multi select or a likert scale can be mapped
- [x] A geolocation answer's latitude and longitude can be typed; the map follows and the address is looked up again for the new point
- [x] A full screen board is padded on all four sides, and the fit calculation measures the room inside that frame
- [x] Build green (tsc and vite both exit 0)

## 24. Why em_backend could not send while the main backend could
- [x] Found the asymmetry: the main backend was stopped by `secure: true` (11.20); em_backend is stopped at the sign-in, because its transporter authenticates and its `.env` has no `EMAIL_USER`/`EMAIL_PASS`
- [x] em_backend warns at startup when the mail account is missing instead of offering an empty user name on every message
- [x] A stray `EMAIL_FROM` that is not an address can no longer make every send fail - all three configs require an `@` before treating it as one
- [x] `deploy/stack.sh` reports per backend whether its env carries the mail account, and warns when a stack's store has no file for a backend at all
- [x] em_backend's invitation path proven sound end to end without sending (config, calendar, composed message)
- [x] dc_backend and em_backend suites green (9 files, 0 fail)

## 25. A mail transport that finds out instead of assuming
- [x] One shared transport per backend (`utilities/mail_transport.js`, identical copies): tries the asked-for way, falls back through the others on a connection failure, remembers what worked
- [x] `EMAIL_SECURE` settles the first way to try; optional, and shared through `deploy/env/shared.env`
- [x] Only connection failures are retried - a wrong password or an unknown recipient is answered at once
- [x] em_backend reaches the server exactly as the backend whose mail arrives does
- [x] All three say one actionable line at startup; dc_backend said nothing before
- [x] A re-activated invitation reports a refused email instead of discarding the answer
- [x] `node test.js` in each backend sends through the real transport and names the way that worked
- [x] Permanent test: 4 cases, ALL_TESTS_PASSED. Each backend's own message: 12 checks, 0 failed

## 26. The main backend's mailer restored
- [x] `backend/utilities/email.js` back to its state at 27521f31 (secure: true, its own sender constant) - `git diff` against that commit is empty
- [x] `backend/test.js` and `backend/configurations/config.js` back to their pre-round state; `backend/utilities/mail_transport.js` removed from that backend
- [x] The shared transport kept only in em_backend and dc_backend, where the mail was not arriving
- [x] `EMAIL_SECURE=true` in `deploy/env/shared.env`, so those two open the connection the way the delivering backend does
- [x] The permanent test moved to `dc_backend/tests/mail_transport.test.js` and joins the DCS suite
- [x] 11.20 and 11.24's claim that STARTTLS is right for this server corrected in 11.25

## 27. Measuring the mail server instead of arguing about it
- [x] `deploy/mail_check.js`: every backend's configured account, TCP to 25/465/587 on every candidate host, the server's first words, which way the credentials are accepted, and the exact EMAIL_* lines to deploy
- [x] Run on the server: 587 answers in plain text, so `secure: true` is refused in 42 ms - the main backend has not been sending
- [x] 11.25's claim that production proved `secure: true` corrected in 11.26
- [x] `secure: false` gets the banner and then times out at the socket timeout, so the failure is after the greeting and is not a setting
- [x] `deploy/mail_dialogue.js`: the whole conversation line by line with 60 s of patience a step, to tell a SLOW server from a SILENT one
- [x] Proven against a slow stand-in and a silent one: 6 checks, 0 failed
- [x] The transcript tool tries EHLO with a full domain name, HELO, the bare name, and port 25 - each on a fresh connection - and prints either the settings that worked or the questions for the provider (11 checks, 0 failed)
- [ ] Waiting on the transcript from the server to decide between a change here and a question for whoever runs the mail server

## 28. Thirty-eight seconds to check a password
- [x] Timed the whole SMTP conversation on the server: everything under 100 ms except the password check, at 38.3 s
- [x] The 15 s socket timeout in every backend was cutting the sign-in in half and reporting ETIMEDOUT
- [x] `backend/utilities/email.js` carries the exact values proven on the server (secure false, requireTLS, 6550000/6550000/655000) - the hand edit is in the repository so a deploy cannot overwrite it
- [x] em_backend and dc_backend take the same patience from one knob, `EMAIL_TIMEOUT_MS` (default 655000)
- [x] Both also say EHLO with `EMAIL_HELO_NAME`, a name that server is known to accept
- [x] No pooling: a pool and a fallback do not mix, and bulk sends already go out in parallel
- [x] Test: a server that holds the password for 17 s - fails on the old timeouts, passes now. 8 checks, ALL_TESTS_PASSED
- [x] Fixed two lies in the tooling: a stand-in that could not speak AUTH PLAIN, and process.exit() discarding a passing test's output on Windows
- [ ] For the provider (AOS): why does the SASL lookup for coksystems@ take 38 s on proxymta-server.aos.rw
