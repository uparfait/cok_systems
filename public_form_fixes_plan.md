# Public form and review page - fixes plan

Scope: the public data collection page (`/dcs-form/:id`), the builder's review rehearsal (ReviewOverlay, same renderer), and the data tables that show what was collected.

## 1. File inputs (image / video / audio / file upload)
- [x] Root causes: the hidden `<input type="file">` used `display:none` and a programmatic `.click()`, which some mobile browsers and in-app webviews ignore; `capture="environment"` on image/video/audio forced camera-only on Android and iOS
- [x] The visible control is now a read-only text input that looks like every other input (focus ring, pointer) with the real file input laid transparently over it, so a tap lands on the native control itself: no programmatic click, works in webviews
- [x] `capture` removed from the image/video/audio fields: the OS chooser offers camera, gallery and files
- [x] Link mode keeps working: the "Select a file" button carries the same overlay input

## 2. Offline saving
- [x] After a submit that could not reach the server the respondent sees a centered notice: "Not sent yet - saved on this device", with what happens next; the inline result screen reads the same way
- [x] Storage fallback chain `IndexedDB -> localStorage -> memory` (`offline/offlineStorage.js`), Files stored as data URLs in the localStorage tier; `navigator.storage.persist()` requested; when only memory is available the respondent is told to keep the page open
- [x] Saved (ready) records cannot be deleted from the panel - only the draft has a delete; unchanged and re-verified
- [x] The draft found on load is offered in a centered overlay (Continue / Discard) instead of the top bar
- [x] Queue is flushed the moment the `online` event fires, not only on the 60 s tick
- [x] A draft holding only auto-detected GPS coordinates is never autosaved or offered back (it is cleared on load); a resumed real draft drops its stored coordinates so a fresh position is detected

## 3. Location
- [x] `watchPosition` with high accuracy; a new reading replaces the stored one only when its accuracy is better (smaller); a place picked by search is never overwritten by device readings
- [x] Denied / off / timed out: a clear message plus an "Allow location" button that re-triggers the browser's native permission prompt; when the browser has it blocked, step-by-step instructions; insecure (http) pages explained
- [x] Address lookup re-runs once connectivity returns when coordinates exist without an address
- [x] Detection starts by itself whenever no real position is stored and nothing is being watched (first load, resumed draft, after a StrictMode effect re-run); high-accuracy timeout falls back to a network fix; the guide button and the district cascade Retry are inline icons
- [x] Draft check is schema-aware: hidden, computed and preset values do not make a draft; "Continue as" shows the first name only; the public form loading indicator is the writing-pen icon (`DcsWritingPenIcon`)

## 4. Install / add to home screen
- [x] On `/dcs-form/...` the manifest is swapped at startup for a dynamic one whose `start_url`, `id` and `scope` are the form's own URL (`pwa/dynamicManifest.js`), so the installed icon opens the form, not `/`
- [x] `DcsInstallPrompt` lives inside the saved-records panel under the notes: the text "For faster form access, install this form" with a download icon that opens the native install prompt (on iPhone it reveals the Share > Add to Home Screen steps); page indicators (wifi, saved count, chevron tab, print) stay icons

## 5. Review rehearsal
- [x] ReviewOverlay card uses the public form's border (5 px, `rgba(5,109,170,0.35)`, rounded) and page padding
- [x] Same respondent gate, file inputs and location behaviour as the public page (shared components)

## 6. Respondent identity
- [x] On page start: name, email and telephone asked in a centered mobile-first overlay; saved in localStorage; on later loads "Continue as ..." / "Change"
- [x] Every submission (direct or queued) carries `respondent {name, email, phone}`; backend sanitises and stores it
- [x] Data tables (per version and all versions) show a "Submitted by" column; Excel export too; search matches the respondent; approval form view footer shows who submitted
- [x] i18n level en / fr / kn (frontend and backend)

## 7. Verification
- [x] `node --check` on every changed backend file
- [x] Offline proof of the storage fallback serialisation (scratch script)
- [x] Frontend build green

## 8. Translation links (translator identity)
- [x] The texts leave the server only for an identified translator: GET returns the form name and locked languages alone; the identify call (name, email, phone) finds or creates the translator for the link (`dcs_form_translators`), remembers their page, and returns the fields as the form holds them plus that translator's OWN proposals only
- [x] Translators work in isolation: nobody sees anyone else's texts, everyone may change every field; proposals are stored per translator (same text by two translators = two documents)
- [x] Editor review: first the translators by name (contact, pending / applied counts, page reached); opening one shows the WHOLE form field by field with that person's proposed texts beside the current ones (untouched fields read "No change"); apply / restore / dismiss act on that translator's texts
- [x] Identity overlay shows "Waiting..." while the identify request runs; page restyled to the system look (shadow cards, plain language switch, fewer colors, compact sticky bottom bar, phone gutters)

## 9. Shared dashboards
- [x] Switching dashboards behind one share link clears the previous board's filters and data (`useBoardData` resets on scope change)
- [x] A dashboard that is still loading shows a board-shaped skeleton (header, KPI row, chart cards with a soft sweep) on the shared and the signed-in page
- [x] Switching dashboards also resets the period to the default (this year); the filter bar Clear puts the date back too (`reset_period`)
- [x] Skeleton follows the board theme (dark class passed in) with a slow back-and-forth sweep; the shared page picks dashboards with the same themed DashboardSwitcher as the signed-in board
- [x] A dashboard page lists share links that combine it as an extra board (query on `extra_dashboards.dashboard_id`), marked "Shared from X", editable under that board
- [x] Shared links render the SAME arrangement as the editor: the public dashboard answer now carries the saved `layout` (studio grid / free surface, sizes, positions) and the shared page hands it to the same BoardGrid
- [x] A failed widget on a shared board shows the error and Retry only; the "consider removing this widget" hint appears only where the board is editable

## 10. Excel export of responses
- [x] Export runs as a background job: POST `/submissions/export/:form_group_id/start` (202 with job id and total), long-poll `GET /submissions/export-jobs/:job_id`, `GET .../download`, `POST .../cancel`; the dialog shows counting, then "Writing row X of Y", then download progress, and lets the user stop it
- [x] Speed: one Mongo cursor over the range (projection, batches of 1000, no skip/limit pages, one count), rows streamed into a zipped .xlsx by a hand-rolled writer (`utilities/xlsx_stream_writer.js`: inline strings, no cell objects, constant memory) - measured 0.25 ms per 40-column row (20k rows in 4.9 s, 23 MB heap) against 1.48 ms with ExcelJS streaming and minutes with the old page-by-page workbook; file read back by ExcelJS with styles and values intact
- [x] File answers export as full addresses on the site (frontend origin + path); locations as "lat, lng - address"; multi-selects joined; Submitted by column included; the old one-shot GET export reuses the same column and cell helpers

## 11. Data feed for analysis tools (Power BI, Excel)
- [x] Access tokens per form (`dcs_data_feed_tokens`): name, expiry (never / 7d / 30d / 90d / 1 year / a date), scope (one version, a date window), uses and last use, renew (new secret) and revoke; editors only (`/forms/:id/data-tokens`)
- [x] Public feed `GET /public/data-feed/:token` - JSON pages { count, next, previous, results } or ?format=csv streamed; filters from, to, since, version, page, limit, keys=id|label, always inside the token scope; `/schema` lists the columns; 401 invalid, 410 expired; token also accepted as ?token= or Bearer
- [x] Rows keyed by field label (unique), file answers as full URLs, locations as "lat, lng - address", id / version / submitted by / submitted at included
- [x] Data page: share icon above the table opens the tokens dialog with CSV / JSON / schema links to copy, Power BI steps, create / renew / revoke
- [x] Export cancel message shortened to "Cancelling export..."
