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
- [x] Every translator first says who they are (name, email, phone) in the same identity overlay as the public form; POST `/public/translate/:token/translator` finds them by email for this link or creates them (`dcs_form_translators`), remembers the page they are on, and returns their proposals - a returning translator resumes on that page
- [x] Every proposal stores its translator; a field one translator worked on is theirs alone: others see it read-only with "Translated by NAME", and the server refuses their saves on it (409 TRANSLATION_FIELD_TAKEN)
- [x] The editor review names each proposal translator with email and phone
- [x] Page restyled to the system look: white cards with the system shadow instead of borders, plain text language switch, fewer colors, compact sticky bottom bar with safe-area padding, phone gutters
