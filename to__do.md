# Visitors restructure - Smart Parking and Service Delivery

Status legend: [ ] to do, [x] done.

## Decisions taken (tell me if any should change)

1. Visitor fields are named exactly as requested: identification (id_type + number), full_name, telephone, email,
   gender (Male / Female), Is_In_House, N_visits, plus createdAt / updatedAt.
2. Unique fields: identification number, telephone, email (email stays optional). Values are normalised before the
   check (ID number upper case without spaces, Rwandan phones in the 07XXXXXXXX form, email lower case), so
   "0788 123 456" and "+250788123456" are the same telephone.
3. Required, as on the check-in forms before: full name and telephone. ID number, email and gender are optional
   (an ID number is checked against its type, an email must be valid). Without an ID number the telephone
   identifies the visitor. A check-in never erases what is already saved: empty fields keep the old values.
4. A visitor can have only one open (in house) visit at a time. A car check-in for a visitor opens the visit, or
   links the car to the visit that is already open.
5. Staff cars: the driver is stored in Visitors (the car keeps only the reference) but no service-delivery visit is
   opened for staff, so staff do not appear as in-house visitors at reception.
6. Is_In_House = the visitor has an open visit. N_visits goes up by one each time a visit opens (walk-in or car),
   and for each staff car check-in. A car check-in for someone already in house does not count twice.
7. Badges are back as before (your instruction): an optional Badge Number on the car check-in, the visitor check-in
   and the reception New Visitor form, kept on the visit and on the car. A badge held by someone inside is refused.
   Partial exit takes the badge back (cleared on the visit and the car); Returned asks for a badge again (optional)
   and saves it on both. Badge shows in the gate lists and the visitor panel and can be searched.
8. Attachments belong to visits (service delivery). They are added to the open visit, or to the latest visit when
   the visitor is not in house. Unlimited files and size; downloads require login. Files saved together share one
   description (a batch); the Attachments tab lists batches (description, who added it, then the files with open /
   download / edit icons), 10 per page, loading more when scrolled to the bottom. Editing a description changes it
   for every file of the batch; replacing a file changes only that file.
9. Panel actions by role: employee = Serve, Transfer (and Complete when they are the one serving); every other role
   (receptionist, head of department, gate officer, admin, mayor) = Send to department; everyone = add attachments
   and edit their own attachments; visitor details can be edited only while the visitor is in house.
10. Only one person can serve a visitor at a time; everyone sees who is serving.
11. The employee "Department Queue" link also did nothing (the employee dashboard ignored ?tab=). It will now open
    the department queue. The head of department "Service History" tab works and stays.
12. The overlay close button becomes the circled transparent X icon you asked for (this is the only new icon).
13. "All tables / all overlays / all forms" (sections 9, 10, 11) covers every system EXCEPT DCS and event management,
    which are never touched (your instruction). Their files were restored to how they were before this work.
14. Car and visitor check-in keep the forms and flow the system always had (your instruction): verify the plate and
    the check-in form opens straight away (pre-filled when the car is known); the visitor forms search by ID number;
    a car or person not in the system is simply saved during the check-in, nobody is asked to register first.
15. The admin "Legacy Data" link shows in the sidebar only while old-structure records exist (checked when the
    page loads and every few minutes, and right after a scan or a delete on the Legacy Data page).
16. Gate dashboard "Hourly Parking Analytics": a Period select with Today / Yesterday / This Week / This Month /
    This Year / Custom. It opens on Today, or - when a car still parked, or a car that left today, arrived before
    today - on Custom from the day that car arrived, so its check-in shows on its own day and its check-out on
    today. Only smart parking records (cars) are counted, never visitor visits. Custom opens a small overlay (From day + hour, To day + hour, 24h) and reloads only on
    Apply. Today and yesterday by hour, week and month by day, year by month; custom by hour, day, week, month or
    year from its length. Grouped bars (check-ins blue, check-outs green, flagged red), 2px apart, centred on their
    label with empty bars left out and the number above each bar. Whole numbers only, totals follow the period, a
    plain spinner shows while loading. Mobile first; small parts (icon, buttons, select, chips, tiles) rounded.
    Every period shows all its hours / days / months up to now, empty ones included. Inside each blue check-in bar
    a see-through green part, from the top down, shows how many of the cars that entered then have already left
    (whenever they left); its number shows only on hover.
17. Nothing is done twice: checking out someone already gone, a partial exit for someone already outside, a
    return for someone already inside, checking out a car that already left and sending a visitor again to the
    department where they already wait are all refused with a clear message (who and when). Closing a visit is
    atomic, so two gates acting at the same moment cannot both succeed, and the buttons lock on the first click.
18. Overview page: the six figure cards open a table of the people behind them (visited in the period, in house now,
    returning, registered, served in the period, not served yet). A visitor in that table opens the panel read only:
    details and attachments to open or download, no edit, no actions, no Add attachment. The full-screen button is a
    small round icon that can be dragged anywhere; its place is remembered. Overlays open inside full screen too.

## 1. Data models (backend)

- [x] 1.1 New `Visitor` model with the fields above, unique indexes, timestamps
- [x] 1.2 `ServiceDelivery` keeps only visit data + `visitor` reference (personal fields and badge removed),
      adds current server, attachments, parking link, one-open-visit rule
- [x] 1.3 `ParkingRecord` keeps only car data + `visitor` reference (driver fields and badge removed), adds visit link,
      no double active record per plate
- [x] 1.4 `FlaggedVehicle` stores `visitor` and parking record references instead of driver details
- [x] 1.5 `ServiceTracking` rows reference the visitor and the visit
- [x] 1.6 Shared visitor helpers: normalise, find conflicts, create or update a visitor, open/close visits,
      parking sessions, serving lock, department scope, response shaping

## 2. Visitor registration rules

- [x] 2.1 Unique check on identification, telephone and email: "Someone with this <field> is already registered (Name)";
      same visitor (same _id) = update instead of error
- [x] 2.2 Visitor check-in (reception and gate person check-in): look up Visitors, fill the form when found, every
      field editable, changes update that visitor
- [x] 2.3 Receptionist "register visitor" applies the same checks
- [x] 2.4 Visitor checking in with a car: the car and the visit are both recorded (no more forced logout for receptionists)
- [x] 2.5 N_visits counted on every check-in, with or without a vehicle
- [x] 2.6 Badge number optional on check-in forms, cleared on partial exit, asked again on return (decision 7)

## 3. Vehicle check-in (/checkin-vehicle)

- [x] 3.1 Car checked in as usual, driver details stored only as a visitor reference
- [x] 3.2 Plate entered: if the car parked before, the last visitor who came with it is filled in, editable
- [x] 3.3 Driver not in the system: added to Visitors first, then linked to the car
- [x] 3.4 Driver type decided by the server (staff registry / reservation / regular)
- [x] 3.5 Car lists everywhere show the person who came with the car (populated visitor)
- [x] 3.6 Car check-out closes the linked visit (exit time and durations recorded)

## 4. Global visitor panel (opens when a visitor is clicked, all roles, not on check-out pages)

- [x] 4.1 Panel with headers: Info, Add attachment, Attachments
- [x] 4.2 Info: all visitor details, N visits, in house, current visit, who is serving now
- [x] 4.3 Info bottom: Send to department (non-employee roles) / Serve and Transfer (employees), only while in house
- [x] 4.4 Serving lock: when someone serves, nobody else can serve; other actions (attachments) still allowed
- [x] 4.5 Edit visitor details only while in house
- [x] 4.6 Add attachment: any number of files, any size, each with a description
- [x] 4.7 Attachments: list with description and who added it (name, email, telephone, department, time),
      current visit first
- [x] 4.8 Attachment can be updated only by the person who added it
- [x] 4.9 Every visitor row and name in SD and SP screens opens the panel (except check-out pages)

## 5. Visitors page (one page for every role that has the Visitors link)

- [x] 5.1 Same page for receptionist and employee (remove the visitors / all-visitors contradiction)
- [x] 5.2 Table designed like the Applicant Selection Console table: search and filters inside the column headers,
      only the time filter at the top
- [x] 5.3 In house filter in its header: In house (default) / Not in house / All; in-house visitors first
- [x] 5.4 Sorted by last update (newest first)
- [x] 5.5 "My departments": employee = own department, head of department = whole department and its units
- [x] 5.6 Columns show all visitor details including N visits
- [x] 5.7 Register visitor from the page (with optional car plate)

## 6. Navigation clean-up

- [x] 6.1 Remove the "Assigned Visitors" link and page
- [x] 6.2 Remove employee "Service History" (dashboard?tab=history)
- [x] 6.3 Employee "Department Queue" opens the queue (see decision 11)
- [x] 6.4 Keep the three copies of Default_Roles.json identical

## 7. Admin: legacy data

- [x] 7.1 Admin link "Legacy Data"
- [x] 7.2 Scan smart parking, service delivery and related collections for records in the old structure
- [x] 7.3 Delete them after confirmation, then recalculate parking counters and in-house flags

## 8. Downloads and statistics

- [x] 8.1 Visitors download built from service delivery visits, each populated with its visitor
- [x] 8.2 Parking download built from parking records, each populated with its visitor
- [x] 8.3 All statistics updated to the new structure (gender, visitor counts, in house, queues, dashboards,
      KPIs, performance, mayor and admin views)

## 9. All tables across the system

- [x] 9.1 Body scrolls horizontally and vertically, header stays fixed, cells do not wrap
- [x] 9.2 Visitor and parking tables show all visitor details and N visits

## 10. All forms

- [x] 10.1 Every required field label carries a red *

## 11. All overlays across the system

- [x] 11.1 Remove the blue header bar
- [x] 11.2 Close in the header as a circled transparent icon
- [x] 11.3 Remove Cancel buttons (Close does it)
- [x] 11.4 Closing is blocked while a process is running

## 12. Server and deployment

- [x] 12.1 Upload size unlimited end to end (backend and nginx)
- [x] 12.2 New realtime events for visitor updates and attachments

## 13. Verification

- [x] 13.1 Backend tests against a real MongoDB engine (registration, conflicts, check-in/out, serving lock,
      attachments, legacy clean-up)
- [x] 13.2 Frontend type check and production build pass
- [ ] 13.3 Independent review of all changes

## Round 2 (2026-10-12)

### A. Departments page (/:roleSlug/departments)

- [x] A1 Backend sends every department and unit (no limit), with the number of people in each counted from the
      employee accounts (units included, the stored total_employees ignored), plus totals: departments and units
- [x] A2 Assigning a leader: employee search served by the backend

### B. Tasks (/tasks)

- [x] B1 All tasks fetched and sent, no limit
- [x] B2 Overdue tasks: red border, and an "Overdue" tag on in-progress tasks past their due date

### C. Visitors

- [x] C1 Add attachment: the description is a textarea in the system input style
- [x] C2 Send / transfer to a department: search departments, search units once a department is chosen, search employees
- [x] C3 Transfer: the notes input is removed

### D. DCS

- [x] D1 Every overlay and overlay table: white header without background colour, the circled transparent close icon
      (as on the visitor panel), no Cancel buttons (Close does it)
- [x] D2 Dashboard widgets sized from the screen: widths fill the screen, heights follow the width, on every screen size
- [x] D3 Form data page: "Download & imports". Import: CSV only, upload with progress, backend returns the CSV headers and
      the form's fillable data fields; a 90% x 90% mapping screen (CSV headers left, form fields right; a location field
      takes latitude, longitude and accuracy); step two chooses what to do with empty values per field (respecting
      select, radio, time and other types); then the import runs. Download: the form's CSV header template

### E. Admin (added 2026-10-12)

- [x] E1 Admin dashboard: the "Today's Check-ins" card becomes "Cars inside" and the API sends that count only
- [x] E2 Admin dashboard: "Parking Activity (Hourly)" becomes the gate dashboard chart with its period filter
- [x] E3 Storage management: the visitors collection (models/visitor.js) is listed too
- [x] E4 Deleting a department counts its employees instead of reading total_employees
- [x] E5 Feedback analysis: the department filter is a search served by the backend
- [x] E6 Departments page: the employees of a department open 20 per page from the backend, with a search
- [x] D3a Import run: no transactions, insertMany 50 rows at a time read from the CSV on disk, progress shown while it
      runs, on any error everything saved by that import is removed and the error is announced with the row and field
- [x] D3b Export: a map / location field gives only latitude, longitude and accuracy columns (no address)
- [x] D3c Mapping step: clicking a CSV header starts a line that follows the mouse and connects to the form field
      clicked next, drawn with right-angle rounded corners like MySQL Workbench relationships; one colour per pair,
      hover highlights, click removes
- [x] E7 Admin dashboard: every card figure comes from the backend as a real number, nothing counted in the browser
- [x] E8 Visitors page order: in house and not yet sent to a department first (newest first), then in house and sent,
      then not in house

## Round 3 (2026-10-14): widget positions, delete by email code, follow-up forms

Decisions taken (tell me if any should change)
- Widget order: a board keeps the "KPI cards first, then charts" look until someone changes a position; from then on
  the saved array order is the order on the board (any widget anywhere). Marked by layout.ordered = true.
- Deleting records on the form data page (/data): the Delete selected action sends a 6-digit code to the signed-in
  user's email; the deletion runs only with that code. Codes expire after 15 minutes, 5 attempts.
- Follow-up form: one per form, its own versions, its own public link, its own data collection
  (dcs_follow_up_submissions). Records are found from the ACTUAL form's data, loaded into the follow-up form, edited and
  saved as a NEW follow-up record; the actual record is never changed. Dashboards choose their source when created.

### P. Widget position (dashboard)
- [x] P1 Widget menu item "Change position" (editors only) in the card menu of every widget and in the canvas widget
      menu: opens an overlay showing "This dashboard has N widgets", the widget's current position, an input 1..N and
      Save; the widget moves to that position (any widget, KPI or chart, first to last or last to first)
- [x] P2 Board order: the saved widgets array order is the board order once layout.ordered is true; boards without it
      keep KPI-first; the first position change normalises the array to the shown order, moves, saves ordered = true
- [x] P3 Backend sanitize_board_layout keeps ordered (boolean); public share boards follow the same rule

### D. Delete with an email code (form data page)
- [x] D1 POST /dcs/api/submissions/delete-selected/request {submission_ids} -> creates dcs_deletion_requests
      {user_id, email, submission_ids, code, attempts, expires_at, used_at}, emails the code, answers
      {request_id, email_masked, expires_at} (code echoed outside production only, like batch approval OTP)
- [x] D2 POST /dcs/api/submissions/delete-selected/confirm {request_id, code} -> verifies (owner, expiry, attempts),
      deletes with the existing permission check, marks used; POST .../resend re-sends the same code
- [x] D3 Frontend: Delete selected opens a two-step overlay (DCS design, circled close, no Cancel): "A code was sent to
      a***@x.rw", code input, Delete button, resend link, error texts; en/fr/kn

### F. Follow-up form
API contract (both agents follow it exactly):
- Collection dcs_follow_up_forms: one document per version
  { follow_up_group_id (uuid), source_form_group_id, project_id, version, is_active, form_name, form_name_normalized,
    schema {fields}, ask_respondent, created_by, created_by_name, updated_by, updated_by_name, created_at, updated_at }
- Collection dcs_follow_up_submissions:
  { follow_up_group_id, version, source_form_group_id, source_submission_id (ObjectId|null), project_id, data,
    submitted_at, updated_at, respondent, client_submission_id, media like dcs_submissions }
- Authenticated routes (same auth as /forms, editors = resolve_form_management(source form).edit_forms, viewers = can_view_form_group):
  GET    /dcs/api/forms/:form_group_id/follow-up                 -> { follow_up: active version | null, versions: [...] }
  POST   /dcs/api/forms/:form_group_id/follow-up                 -> creates version 1 from the source's active version
                                                                     (name "<form name> follow-up", same schema) ; 409 if exists
  PUT    /dcs/api/forms/:form_group_id/follow-up                 {form_name, schema, ask_respondent}
                                                                  -> new version when the data field set changed, else in place
  PUT    /dcs/api/forms/:form_group_id/follow-up/active-version  {version}
  DELETE /dcs/api/forms/:form_group_id/follow-up/versions/:version {delete_data}
  GET    /dcs/api/forms/:form_group_id/follow-up/submissions     ?page&limit&period&from&to&search&sort&record
                                                                  -> same shape as GET /submissions/:fg
  GET    /dcs/api/forms/:form_group_id/follow-up/submissions/:id -> one record (with source_submission_id)
  PUT    /dcs/api/forms/:form_group_id/follow-up/submissions/:id {data} -> validated like a submission, updated_at
  POST   /dcs/api/forms/:form_group_id/follow-up/submissions/delete-selected {submission_ids}
  GET    /dcs/api/forms/:form_group_id/follow-up/media           ?page&limit&period&from&to -> same shape as /submissions/:fg/media
  GET    /dcs/api/submissions/:form_group_id/media?scope=all     -> source + follow-up media, each item carries
                                                                     source: "form" | "follow_up" and follow_up_group_id
- Public routes (no auth):
  GET    /dcs/api/public/follow-up-forms/:follow_up_group_id     -> { follow_up_group_id, source_form_group_id, form_name,
                                                                     version, schema, ask_respondent, searchable_field_ids }
                                                                     searchable = text, number, large_text fields of the ACTIVE
                                                                     source version that also exist in the follow-up schema
  GET    /dcs/api/public/follow-up-forms/:id/search?field=&q=&page=  -> source form records whose data[field] contains q
                                                                     (number: equals), 20 per page, { items:[{_id, submitted_at,
                                                                     data}], page, pages, total }
  GET    /dcs/api/public/follow-up-forms/:id/records/:submission_id -> one source record { _id, data, submitted_at }
  POST   /dcs/api/public/follow-up-forms/:id/submit {version, data, source_submission_id, client_submission_id, respondent}
                                                                  -> validate_submission_data with the follow-up schema; insert
  GET/PUT /dcs/api/public/follow-up-records/:id                   -> edit page for one follow-up record (like /public/records/:id)
- Dashboards: dashboard document gains source: "form" | "follow_up" (default "form") and follow_up_group_id.
  POST /forms/:fg/dashboards {name, source}. A follow_up dashboard validates widgets against the follow-up's active schema
  and every pipeline reads dcs_follow_up_submissions (match on follow_up_group_id). GET /forms/:fg/dashboards items carry
  source. The public link context carries the same.
- Public link of the follow-up form: /dcs-form/follow-up/:follow_up_group_id ; edit: /dcs-form/follow-up/edit/:id
- Pages: /dcs-system/project/:project_id/forms/:form_group_id/follow-up (tabs table | gallery | settings via ?tab=)

- [x] F1 (removed) Backend: models follow_up_forms_model.js, follow_up_submissions_model.js; controllers under
      controllers/follow_up/; routes added to routes/forms (authenticated) and routes/public; media scope=all; dashboards
      source; tests in dc_backend/tests/follow_up.test.js (mongodb-memory-server like the other tests)
- [x] F2 (removed) Frontend: sidebar link "Follow up form" under Form overview; FollowUpPage with tabs Table / Gallery / Settings
      (create button when none exists); table = all-data table over follow-up submissions with view, edit, delete;
      gallery = follow-up media only; settings = name + builder + ask respondent + public link + versions (activate /
      delete); PublicFormPage follow-up mode: search control on text/number/textarea fields -> results overlay (20 per
      page, Next) -> record overlay -> "Load into the form" -> edit -> Save as follow-up record; edit page for follow-up
      records; sidebar Gallery shows all (source + follow-up) and a tile opens the right table; Add dashboard asks
      "Form data" or "Follow-up data" when a follow-up form exists
- [x] F3 (removed) Lead: build, suites, independent review of P, D, F

### F. Follow-up form: DROPPED (2026-10-14, user decision) - all follow-up backend and frontend code removed; the key
    index (record tracking) is the only mechanism. Kept from that work: the search icon inside inputs
    (fields/base/BaseTextLikeField.jsx SearchableInput), DcsCenterOverlay large/scroll fixes, DcsDataTable
    PageArrowButton export, DcsSubmitControl disabled, the data table free-text search bug fix ($$ variables).

### K. Key index (record tracking) extension
API contract (both agents follow it exactly):
- tracking config (form version): { enabled, key_field_ids: [field ids, 1..5, order kept], key_field_id: first id
  (kept for old readers), key_unique: boolean (the COMBINATION of all key values must be unique), editable_field_ids }.
  validate/normalize accept the old single key_field_id and turn it into key_field_ids: [id].
- tracked record: record_key = normalised key values joined with "|" in key order (uniqueness, old readers);
  record_key_pairs: [{ f: field_id, k: normalised value }] for lookup (index { form_group_id, "record_key_pairs.f",
  "record_key_pairs.k" }); tracking_periods, history, updated_at as today.
- GET /dcs/api/public/forms/:fg/records?field=<key field id>&key=<typed value>&page=1&limit=20 -> 200
  { key, field_id, key_field_ids, editable_field_ids, records: [to_public_record], page, pages, total };
  without field: any key field matches; key normalised like record_key_of; 400 TRACKING_KEY_REQUIRED, 400
  TRACKING_NOT_ENABLED; max limit 50.
- PUT /dcs/api/public/forms/:fg/records/:id unchanged (editable fields only). Submit: 409 TRACKING_KEY_EXISTS when
  key_unique and the combination exists (field_errors on every key field).
- Tables and dashboards read the CURRENT state: one row per record with its current data; a period keeps a record
  that was created OR last updated in the period (date_window_filter semantics); time buckets of over-time widgets
  and KPI windows use last_moved_at = ifNull(updated_at, submitted_at) on tracked forms, submitted_at otherwise.
  No stage expansion anywhere in tables or dashboards. Export and data feed keep their current behaviour.
- [x] K1 Backend: tracking.js multi-key config, record_key + record_key_pairs, tracking_fields_for_new,
      apply_record_key, submit_response 409 on the combination, import runner unchanged in behaviour
- [x] K2 Backend: paged lookup by field, any-key lookup, index; update route untouched
- [x] K3 Backend: list_submissions / get_form_submission_stats / submission_values / media and every util-dashboard
      pipeline read the current state (no stages), period = created or last updated; tests updated
      (tracking_stages, dashboard_stages, tracking_window) + new tests/tracking_lookup.test.js
- [x] K4 Frontend setup wizard: choose several key fields (checkboxes, order kept), unique = the combination
- [x] K5 Frontend public form: search icon inside every key field input at the left; lookup overlay responsive
      (scrolling body, full screen under 640px), results as a table with every field in form order, submitted and
      updated dates first, sticky header, x and y scroll, the data table's pager icons, 20 per page, Load and
      Show history per row; loaded record banner and update flow as today
- [x] K6 Frontend tables: one row per record (no stage rows), updated_at and history columns kept
- [ ] K7 Lead: build, suites, review
